from django.db import transaction

from .models import Team, TeamUser


class TeamServiceError(Exception):
    def __init__(self, message, status_code):
        super().__init__(message)
        self.status_code = status_code


class TeamService:
    @staticmethod
    @transaction.atomic
    def create_team_with_creator(*, validated_data, creator):
        team = Team.objects.create(**validated_data)
        TeamUser.objects.create(team=team, user=creator, is_admin=True)
        return team

    @staticmethod
    @transaction.atomic
    def join_team(*, team_id, user):
        team = Team.objects.filter(id=team_id).first()
        if team is None:
            raise TeamServiceError('Team not found', 404)

        membership, created = TeamUser.objects.get_or_create(
            team=team,
            user=user,
            defaults={'is_admin': False},
        )
        return team, membership, not created

    @staticmethod
    @transaction.atomic
    def make_admin(*, team_id, user_id):
        team = Team.objects.select_for_update().filter(id=team_id).first()
        if team is None:
            raise TeamServiceError('Team not found', 404)

        membership = (
            TeamUser.objects.select_for_update()
            .select_related('user')
            .filter(team=team, user_id=user_id)
            .first()
        )
        if membership is None:
            raise TeamServiceError('User is not a member of this team', 404)

        if not membership.is_admin:
            membership.is_admin = True
            membership.save(update_fields=['is_admin'])

        return membership

    @staticmethod
    @transaction.atomic
    def make_member(*, team_id, user_id):
        team = Team.objects.select_for_update().filter(id=team_id).first()
        if team is None:
            raise TeamServiceError('Team not found', 404)

        membership = (
            TeamUser.objects.select_for_update()
            .select_related('user')
            .filter(team=team, user_id=user_id)
            .first()
        )
        if membership is None:
            raise TeamServiceError('User is not a member of this team', 404)

        if membership.is_admin:
            remaining_admins = (
                TeamUser.objects.select_for_update()
                .filter(team=team, is_admin=True)
                .exclude(user_id=user_id)
                .count()
            )
            if remaining_admins == 0:
                raise TeamServiceError('Team must have at least one admin', 400)

            membership.is_admin = False
            membership.save(update_fields=['is_admin'])

        return membership

    @staticmethod
    @transaction.atomic
    def remove_member(*, team_id, user_id, acting_user_id):
        team = Team.objects.select_for_update().filter(id=team_id).first()
        if team is None:
            raise TeamServiceError('Team not found', 404)

        if int(user_id) == int(acting_user_id):
            raise TeamServiceError('You cannot remove yourself from the team', 400)

        membership = (
            TeamUser.objects.select_for_update()
            .filter(team=team, user_id=user_id)
            .first()
        )
        if membership is None:
            raise TeamServiceError('User is not a member of this team', 404)

        if membership.is_admin:
            remaining_admins = (
                TeamUser.objects.select_for_update()
                .filter(team=team, is_admin=True)
                .exclude(user_id=user_id)
                .count()
            )
            if remaining_admins == 0:
                raise TeamServiceError('Team must have at least one admin', 400)

        membership.delete()
        return int(user_id)
