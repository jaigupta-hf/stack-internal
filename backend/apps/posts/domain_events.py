from django.db import transaction
from django.dispatch import Signal


# Post/content lifecycle events.
post_edited = Signal()
answer_created = Signal()
answer_edited = Signal()

# Question interaction events.
question_closed = Signal()
question_deleted = Signal()

# Cross-domain side-effect events.
answer_approval_changed = Signal()
bounty_awarded = Signal()


def emit_post_event(signal, **kwargs):
    """Emit a domain event after transaction commit when inside an atomic block."""

    def _emit():
        signal.send(sender=None, **kwargs)

    transaction.on_commit(_emit)
