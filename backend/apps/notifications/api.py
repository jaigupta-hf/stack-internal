from .models import Notification


# Handle create notification.
def create_notification(*, post, user, triggered_by, reason):
    if not post or not user or not triggered_by:
        return None

    if user.id == triggered_by.id:
        return None

    return Notification.objects.create(
        post=post,
        user=user,
        triggered_by=triggered_by,
        reason=reason,
    )
