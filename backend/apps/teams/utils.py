from .permissions import get_team_membership


def get_team_member_name(team_id, user_id, default_name='deleted user'):
    membership = get_team_membership(team_id=team_id, user_id=user_id, select_related_user=True)
    if not membership:
        return default_name

    return membership.user.name
