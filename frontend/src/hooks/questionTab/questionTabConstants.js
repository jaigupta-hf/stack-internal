import { formatRelativeTimestamp } from '../../utils/dateTime';

export const formatQuestionTime = (timestamp) => formatRelativeTimestamp(timestamp);

export const isActuallyEdited = (createdAt, modifiedAt) => {
  if (!createdAt || !modifiedAt) {
    return false;
  }

  const created = new Date(createdAt).getTime();
  const modified = new Date(modifiedAt).getTime();

  if (Number.isNaN(created) || Number.isNaN(modified)) {
    return false;
  }

  return Math.abs(modified - created) > 1000;
};

export const getCloseReasonLabel = (reason) => {
  if (reason === 'duplicate') {
    return 'Duplicate';
  }
  if (reason === 'off-topic') {
    return 'Off-topic';
  }
  return 'Closed';
};

export const BOUNTY_REASONS = [
  {
    title: 'Authoritative reference needed',
    description: 'Looking for an answer drawing from credible and/or official sources.',
  },
  {
    title: 'Canonical answer required',
    description: 'The question is widely applicable to a large audience. A detailed canonical answer is required to address all the concerns.',
  },
  {
    title: 'Current answers are outdated',
    description: 'The current answer(s) are out-of-date and require revision given recent changes.',
  },
  {
    title: 'Draw attention',
    description: 'This question has not received enough attention.',
  },
  {
    title: 'Improve details',
    description: 'The current answers do not contain enough detail.',
  },
  {
    title: 'Reward existing answer',
    description: 'One or more of the answers is exemplary and worthy of an additional bounty.',
  },
];
