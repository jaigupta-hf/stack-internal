from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from teams.models import TeamUser
from teams.permissions import ensure_team_membership, ensure_team_membership_and_get

from notifications.models import Notification
from notifications.constants import NOTIFICATION_REASON_MENTIONED_IN_QUESTION
from reputation.api import apply_reputation_change
from reputation.models import Bounty
from reputation.constants import REPUTATION_REASON_BOUNTY_EARNED, REPUTATION_REASON_BOUNTY_OFFERED

from .models import Post, PostFollow
from .serializers import (
    AwardQuestionBountyInputSerializer,
    OfferQuestionBountyInputSerializer,
    QuestionAwardBountyOutputSerializer,
    QuestionBountyStateOutputSerializer,
    QuestionFollowStateOutputSerializer,
    QuestionMentionInputSerializer,
    QuestionMentionsCreatedOutputSerializer,
    QuestionMentionsRemovedOutputSerializer,
    RemoveQuestionMentionInputSerializer,
)
from .constants import BOUNTY_DURATION_DAYS, BOUNTY_MIN_REPUTATION_BUFFER
from .views_common import (
    BOUNTY_AMOUNT,
    _first_serializer_error,
    _serialize_bounty,
)


# Handle offer question bounty.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def offer_question_bounty(request, question_id):
    user = request.user

    try:
        question = Post.objects.select_related('team').get(id=question_id, type=0)
    except Post.DoesNotExist:
        return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

    membership, membership_error = ensure_team_membership_and_get(team=question.team, user=user)
    if membership_error:
        return membership_error

    if question.user_id != user.id:
        return Response({'error': 'Only the question author can offer bounty'}, status=status.HTTP_403_FORBIDDEN)

    if question.delete_flag:
        return Response({'error': 'Cannot offer bounty on a deleted question'}, status=status.HTTP_400_BAD_REQUEST)

    if question.closed_reason:
        return Response({'error': 'Cannot offer bounty on a closed question'}, status=status.HTTP_400_BAD_REQUEST)

    if (question.bounty_amount or 0) > 0:
        return Response({'error': 'This question already has an active bounty'}, status=status.HTTP_400_BAD_REQUEST)

    bounty_input_serializer = OfferQuestionBountyInputSerializer(data=request.data)
    if not bounty_input_serializer.is_valid():
        return Response(
            {'error': _first_serializer_error(bounty_input_serializer.errors)},
            status=status.HTTP_400_BAD_REQUEST,
        )
    reason = bounty_input_serializer.validated_data['reason']

    current_reputation = membership.reputation if membership.reputation and membership.reputation > 0 else 1
    if current_reputation < (BOUNTY_AMOUNT + BOUNTY_MIN_REPUTATION_BUFFER):
        return Response(
            {'error': f'You need at least {BOUNTY_AMOUNT + BOUNTY_MIN_REPUTATION_BUFFER} reputation to offer this bounty.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        start_time = timezone.now()
        end_time = start_time + timedelta(days=BOUNTY_DURATION_DAYS)
        bounty = Bounty.objects.create(
            post=question,
            offered_by=user,
            awarded_answer=None,
            amount=BOUNTY_AMOUNT,
            status=Bounty.STATUS_OFFERED,
            reason=reason,
            start_time=start_time,
            end_time=end_time,
        )
        Post.objects.filter(id=question.id).update(bounty_amount=BOUNTY_AMOUNT)
        question.refresh_from_db(fields=['bounty_amount'])

    output = QuestionBountyStateOutputSerializer(
        data={
            'question_id': question.id,
            'bounty_amount': question.bounty_amount,
            'bounty': _serialize_bounty(bounty),
        }
    )
    output.is_valid(raise_exception=True)
    return Response(output.data, status=status.HTTP_200_OK)


# Handle award question bounty.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def award_question_bounty(request, question_id):
    user = request.user

    try:
        question = Post.objects.select_related('team', 'user').get(id=question_id, type=0)
    except Post.DoesNotExist:
        return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

    membership, membership_error = ensure_team_membership_and_get(team=question.team, user=user)
    if membership_error:
        return membership_error

    if question.user_id != user.id:
        return Response({'error': 'Only the question author can award bounty'}, status=status.HTTP_403_FORBIDDEN)

    if (question.bounty_amount or 0) <= 0:
        return Response({'error': 'No active bounty to award'}, status=status.HTTP_400_BAD_REQUEST)

    bounty_award_input_serializer = AwardQuestionBountyInputSerializer(data=request.data)
    if not bounty_award_input_serializer.is_valid():
        return Response(
            {'error': _first_serializer_error(bounty_award_input_serializer.errors)},
            status=status.HTTP_400_BAD_REQUEST,
        )
    answer_id = bounty_award_input_serializer.validated_data['answer_id']

    try:
        answer = Post.objects.select_related('user').get(id=answer_id, type=1, parent_id=question.id, delete_flag=False)
    except Post.DoesNotExist:
        return Response({'error': 'Answer not found for this question'}, status=status.HTTP_404_NOT_FOUND)

    current_reputation = membership.reputation if membership.reputation and membership.reputation > 0 else 1
    if current_reputation < (BOUNTY_AMOUNT + BOUNTY_MIN_REPUTATION_BUFFER):
        return Response(
            {'error': f'You need at least {BOUNTY_AMOUNT + BOUNTY_MIN_REPUTATION_BUFFER} reputation to award this bounty.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        bounty = (
            Bounty.objects.select_for_update()
            .filter(post=question, status=Bounty.STATUS_OFFERED)
            .order_by('-start_time')
            .first()
        )
        if not bounty:
            return Response({'error': 'No offered bounty found for this question'}, status=status.HTTP_400_BAD_REQUEST)

        bounty.status = Bounty.STATUS_EARNED
        bounty.awarded_answer = answer
        bounty.end_time = timezone.now()
        bounty.save(update_fields=['status', 'awarded_answer', 'end_time'])

        Post.objects.filter(id=question.id).update(bounty_amount=0)
        question.refresh_from_db(fields=['bounty_amount'])

        apply_reputation_change(
            user=question.user,
            team=question.team,
            triggered_by=user,
            post=question,
            points=-BOUNTY_AMOUNT,
            reason=REPUTATION_REASON_BOUNTY_OFFERED,
        )
        apply_reputation_change(
            user=answer.user,
            team=question.team,
            triggered_by=user,
            post=answer,
            points=BOUNTY_AMOUNT,
            reason=REPUTATION_REASON_BOUNTY_EARNED,
        )

    output = QuestionAwardBountyOutputSerializer(
        data={
            'question_id': question.id,
            'bounty_amount': question.bounty_amount,
            'bounty': _serialize_bounty(bounty),
            'awarded_answer_id': answer.id,
        }
    )
    output.is_valid(raise_exception=True)
    return Response(output.data, status=status.HTTP_200_OK)


# Handle follow question.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def follow_question(request, question_id):
    user = request.user

    try:
        question = Post.objects.select_related('team').get(id=question_id, type=0)
    except Post.DoesNotExist:
        return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

    membership_error = ensure_team_membership(team=question.team, user=user)
    if membership_error:
        return membership_error

    PostFollow.objects.get_or_create(post=question, user=user)

    followers_count = PostFollow.objects.filter(post=question).count()

    output = QuestionFollowStateOutputSerializer(
        data={
            'question_id': question.id,
            'is_following': True,
            'followers_count': followers_count,
        }
    )
    output.is_valid(raise_exception=True)
    return Response(output.data, status=status.HTTP_200_OK)


# Handle unfollow question.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unfollow_question(request, question_id):
    user = request.user

    try:
        question = Post.objects.select_related('team').get(id=question_id, type=0)
    except Post.DoesNotExist:
        return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

    membership_error = ensure_team_membership(team=question.team, user=user)
    if membership_error:
        return membership_error

    PostFollow.objects.filter(post=question, user=user).delete()

    followers_count = PostFollow.objects.filter(post=question).count()

    output = QuestionFollowStateOutputSerializer(
        data={
            'question_id': question.id,
            'is_following': False,
            'followers_count': followers_count,
        }
    )
    output.is_valid(raise_exception=True)
    return Response(output.data, status=status.HTTP_200_OK)


# Handle add question mentions.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_question_mentions(request, question_id):
    user = request.user

    try:
        question = Post.objects.select_related('team').get(id=question_id, type=0)
    except Post.DoesNotExist:
        return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

    membership_error = ensure_team_membership(team=question.team, user=user)
    if membership_error:
        return membership_error

    mention_input_serializer = QuestionMentionInputSerializer(data=request.data)
    if not mention_input_serializer.is_valid():
        return Response(
            {'error': _first_serializer_error(mention_input_serializer.errors)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    parsed_user_ids = mention_input_serializer.validated_data['user_ids']

    if user.id in parsed_user_ids:
        return Response({'error': 'You cannot mention yourself'}, status=status.HTTP_400_BAD_REQUEST)

    member_ids = set(
        TeamUser.objects.filter(team=question.team, user_id__in=parsed_user_ids).values_list('user_id', flat=True)
    )
    missing_user_ids = sorted(set(parsed_user_ids) - member_ids)
    if missing_user_ids:
        return Response(
            {'error': 'Some users are not members of this team', 'missing_user_ids': missing_user_ids},
            status=status.HTTP_400_BAD_REQUEST,
        )

    created_count = 0
    for target_user_id in parsed_user_ids:
        mention, created = Notification.objects.get_or_create(
            post=question,
            user_id=target_user_id,
            reason=NOTIFICATION_REASON_MENTIONED_IN_QUESTION,
            defaults={'triggered_by': user},
        )
        if created:
            created_count += 1
        elif mention.triggered_by_id != user.id:
            mention.triggered_by = user
            mention.save(update_fields=['triggered_by'])

    mentions = (
        Notification.objects.filter(post=question, reason=NOTIFICATION_REASON_MENTIONED_IN_QUESTION)
        .select_related('user', 'triggered_by')
        .order_by('created_at')
    )

    payload = [
        {
            'id': mention.id,
            'user_id': mention.user_id,
            'user_name': mention.user.name,
            'mentioned_by': mention.triggered_by_id,
            'mentioned_by_name': mention.triggered_by.name,
            'created_at': mention.created_at,
        }
        for mention in mentions
    ]

    output = QuestionMentionsCreatedOutputSerializer(
        data={
            'created_count': created_count,
            'mentions': payload,
        }
    )
    output.is_valid(raise_exception=True)
    return Response(output.data, status=status.HTTP_200_OK)


# Handle remove question mention.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def remove_question_mention(request, question_id):
    user = request.user

    try:
        question = Post.objects.select_related('team').get(id=question_id, type=0)
    except Post.DoesNotExist:
        return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

    membership_error = ensure_team_membership(team=question.team, user=user)
    if membership_error:
        return membership_error

    if question.user_id != user.id:
        return Response({'error': 'Only the question author can remove mentions'}, status=status.HTTP_403_FORBIDDEN)

    remove_input_serializer = RemoveQuestionMentionInputSerializer(data=request.data)
    if not remove_input_serializer.is_valid():
        return Response(
            {'error': _first_serializer_error(remove_input_serializer.errors)},
            status=status.HTTP_400_BAD_REQUEST,
        )
    target_user_id = remove_input_serializer.validated_data['user_id']

    removed_count, _ = Notification.objects.filter(
        post=question,
        user_id=target_user_id,
        reason=NOTIFICATION_REASON_MENTIONED_IN_QUESTION,
    ).delete()

    mentions = (
        Notification.objects.filter(post=question, reason=NOTIFICATION_REASON_MENTIONED_IN_QUESTION)
        .select_related('user', 'triggered_by')
        .order_by('created_at')
    )

    payload = [
        {
            'id': mention.id,
            'user_id': mention.user_id,
            'user_name': mention.user.name,
            'mentioned_by': mention.triggered_by_id,
            'mentioned_by_name': mention.triggered_by.name,
            'created_at': mention.created_at,
        }
        for mention in mentions
    ]

    output = QuestionMentionsRemovedOutputSerializer(
        data={
            'removed_count': removed_count,
            'mentions': payload,
        }
    )
    output.is_valid(raise_exception=True)
    return Response(output.data, status=status.HTTP_200_OK)
