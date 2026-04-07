from teams.permissions import get_team_membership
from .constants import MIN_REPUTATION, REPUTATION_REASON_VALUES

from .models import ReputationHistory

def apply_reputation_change(*, user, team, triggered_by, post, points, reason):
    if points == 0:
        return None

    if reason not in REPUTATION_REASON_VALUES:
        return None

    membership = get_team_membership(team=team, user=user)
    if not membership:
        return None

    # Normalize legacy/stale values so all calculations use the minimum baseline.
    current_reputation = (
        membership.reputation
        if membership.reputation and membership.reputation > 0
        else MIN_REPUTATION
    )
    next_reputation = current_reputation + points
    if next_reputation < MIN_REPUTATION:
        next_reputation = MIN_REPUTATION

    actual_points = next_reputation - current_reputation

    if membership.reputation != next_reputation:
        membership.reputation = next_reputation
        membership.save(update_fields=['reputation'])

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
