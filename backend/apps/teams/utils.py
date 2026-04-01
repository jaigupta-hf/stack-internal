from .models import TeamUser


def get_team_member_name(team_id, user_id, default_name='deleted user'):
    membership = (
        TeamUser.objects.filter(team_id=team_id, user_id=user_id)
        .select_related('user')
        .first()
    )
    if not membership:
        return default_name

    return membership.user.name
