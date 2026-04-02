from teams.models import TeamUser

from .models import ReputationHistory


ALLOWED_REASONS = {
    'upvote',
    'unupvote',
    'downvote',
    'undownvote',
    'accept',
    'unaccept',
    'downvoted',
    'undownvoted',
    'bounty offered',
    'bounty earned',
}


def apply_reputation_change(*, user, team, triggered_by, post, points, reason):
    if points == 0:
        return None

    if reason not in ALLOWED_REASONS:
        return None

    membership = TeamUser.objects.filter(team=team, user=user).first()
    if not membership:
        return None

    # Normalize legacy/stale values so all calculations use the minimum baseline of 1.
    current_reputation = membership.reputation if membership.reputation and membership.reputation > 0 else 1
    next_reputation = current_reputation + points
    if next_reputation < 1:
        next_reputation = 1

    actual_points = next_reputation - current_reputation

    if membership.reputation != next_reputation:
        TeamUser.objects.filter(team=team, user=user).update(reputation=next_reputation)

    if actual_points == 0:
        return None

    return ReputationHistory.objects.create(
        user=user,
        team=team,
        triggered_by=triggered_by,
        post=post,
        points=actual_points,
        reason=reason,
    )
