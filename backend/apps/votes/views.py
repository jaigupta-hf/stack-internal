from django.db import transaction
from django.db.models import F
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from comments.models import Comment
from posts.models import Post
from teams.models import TeamUser
from reputation.api import apply_reputation_change

from .models import Vote


def _resolve_target(post_id, comment_id):
    if bool(post_id) == bool(comment_id):
        return None, None, None, 'Exactly one of post_id or comment_id is required.'

    if post_id:
        try:
            post = Post.objects.select_related('team', 'parent').get(id=post_id, delete_flag=False)
            if post.type == 1 and post.parent_id and post.parent and post.parent.delete_flag:
                return None, None, None, 'Cannot vote on an answer whose question is deleted.'
            return post, None, post.team, None
        except Post.DoesNotExist:
            return None, None, None, 'Post not found.'

    try:
        comment = Comment.objects.select_related('post__team', 'collection__team').get(id=comment_id)
        team = comment.post.team if comment.post_id else comment.collection.team
        return comment.post, comment, team, None
    except Comment.DoesNotExist:
        return None, None, None, 'Comment not found.'


def _check_membership(user, team):
    return TeamUser.objects.filter(team=team, user=user).exists()


def _apply_post_vote_reputation(*, post, team, voter, previous_vote_value, current_vote_value):
    if post.type not in (0, 1):
        return

    if post.user_id == voter.id:
        return

    if previous_vote_value == 1 and current_vote_value != 1:
        apply_reputation_change(
            user=post.user,
            team=team,
            triggered_by=voter,
            post=post,
            points=-10,
            reason='unupvote',
        )
    if previous_vote_value != 1 and current_vote_value == 1:
        apply_reputation_change(
            user=post.user,
            team=team,
            triggered_by=voter,
            post=post,
            points=10,
            reason='upvote',
        )

    if previous_vote_value == -1 and current_vote_value != -1:
        apply_reputation_change(
            user=post.user,
            team=team,
            triggered_by=voter,
            post=post,
            points=2,
            reason='undownvote',
        )
        apply_reputation_change(
            user=voter,
            team=team,
            triggered_by=voter,
            post=post,
            points=1,
            reason='undownvoted',
        )
    if previous_vote_value != -1 and current_vote_value == -1:
        apply_reputation_change(
            user=post.user,
            team=team,
            triggered_by=voter,
            post=post,
            points=-2,
            reason='downvote',
        )
        apply_reputation_change(
            user=voter,
            team=team,
            triggered_by=voter,
            post=post,
            points=-1,
            reason='downvoted',
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_vote(request):
    user = request.user

    post_id = request.data.get('post_id')
    comment_id = request.data.get('comment_id')
    vote_value_raw = request.data.get('vote')
    try:
        vote_value = int(vote_value_raw)
    except (TypeError, ValueError):
        vote_value = None

    if vote_value not in (-1, 1):
        return Response({'error': 'vote must be either +1 or -1'}, status=status.HTTP_400_BAD_REQUEST)

    post, comment, target_team, target_error = _resolve_target(post_id, comment_id)
    if target_error:
        return Response({'error': target_error}, status=status.HTTP_400_BAD_REQUEST)

    if not _check_membership(user, target_team):
        return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

    with transaction.atomic():
        vote, created = Vote.objects.select_for_update().get_or_create(
            user=user,
            post=post if comment is None else None,
            comment=comment,
            defaults={'vote': vote_value},
        )

        delta = vote_value
        previous_vote_value = 0 if created else vote.vote
        if not created:
            if vote.vote == vote_value:
                delta = 0
            else:
                delta = vote_value - vote.vote
                vote.vote = vote_value
                vote.save(update_fields=['vote'])

        if delta != 0:
            if comment is None:
                Post.objects.filter(id=post.id).update(vote_count=F('vote_count') + delta)
                post.refresh_from_db(fields=['vote_count'])
                current_vote_count = post.vote_count
            else:
                Comment.objects.filter(id=comment.id).update(vote_count=F('vote_count') + delta)
                comment.refresh_from_db(fields=['vote_count'])
                current_vote_count = comment.vote_count
        else:
            current_vote_count = post.vote_count if comment is None else comment.vote_count

        if comment is None:
            _apply_post_vote_reputation(
                post=post,
                team=target_team,
                voter=user,
                previous_vote_value=previous_vote_value,
                current_vote_value=vote_value,
            )

    return Response(
        {
            'post_id': post.id if comment is None else None,
            'comment_id': comment.id if comment else None,
            'vote': vote.vote,
            'vote_count': current_vote_count,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def remove_vote(request):
    user = request.user

    post_id = request.data.get('post_id')
    comment_id = request.data.get('comment_id')

    post, comment, target_team, target_error = _resolve_target(post_id, comment_id)
    if target_error:
        return Response({'error': target_error}, status=status.HTTP_400_BAD_REQUEST)

    if not _check_membership(user, target_team):
        return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

    with transaction.atomic():
        try:
            vote = Vote.objects.select_for_update().get(
                user=user,
                post=post if comment is None else None,
                comment=comment,
            )
        except Vote.DoesNotExist:
            return Response({'error': 'Vote not found for this target'}, status=status.HTTP_404_NOT_FOUND)

        previous_vote = vote.vote
        vote.delete()

        if comment is None:
            Post.objects.filter(id=post.id).update(vote_count=F('vote_count') - previous_vote)
            post.refresh_from_db(fields=['vote_count'])
            current_vote_count = post.vote_count

            _apply_post_vote_reputation(
                post=post,
                team=target_team,
                voter=user,
                previous_vote_value=previous_vote,
                current_vote_value=0,
            )
        else:
            Comment.objects.filter(id=comment.id).update(vote_count=F('vote_count') - previous_vote)
            comment.refresh_from_db(fields=['vote_count'])
            current_vote_count = comment.vote_count

    return Response(
        {
            'post_id': post.id if comment is None else None,
            'comment_id': comment.id if comment else None,
            'vote': 0,
            'vote_count': current_vote_count,
        },
        status=status.HTTP_200_OK,
    )
