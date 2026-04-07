# Centralized reputation and bounty tuning values.
# Update values here to propagate changes across all call sites.

MIN_REPUTATION = 1

# Vote reputation deltas (applied by votes app).
UPVOTE_RECEIVER_GAIN = 10
UPVOTE_RECEIVER_LOSS = -10

DOWNVOTE_RECEIVER_LOSS = -2
DOWNVOTE_RECEIVER_REFUND = 2

DOWNVOTE_VOTER_COST = -1
DOWNVOTE_VOTER_REFUND = 1

# Accept/unaccept answer deltas (applied by posts app).
ANSWER_ACCEPT_GAIN = 15
ANSWER_UNACCEPT_LOSS = -15

# Bounty amount and related reputation thresholds.
BOUNTY_AMOUNT = 50
