from django.db import transaction
from django.dispatch import Signal


# Vote lifecycle events.
post_vote_transitioned = Signal()


def emit_vote_event(signal, **kwargs):
    """Emit a vote domain event after transaction commit when inside an atomic block."""

    def _emit():
        signal.send(sender=None, **kwargs)

    transaction.on_commit(_emit)
