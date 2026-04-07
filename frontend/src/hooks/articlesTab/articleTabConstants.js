import { formatRelativeTimestamp } from '../../utils/dateTime';

export const ARTICLE_TYPE_OPTIONS = [
  { label: 'Knowledge article', value: 22 },
  { label: 'Announcement', value: 20 },
  { label: 'How-to guide', value: 21 },
  { label: 'Policy', value: 23 },
];

export const formatArticleTime = (timestamp) =>
  formatRelativeTimestamp(timestamp, { dateOnlyAfterDay: true });

export const formatArticleListTime = (timestamp) => formatRelativeTimestamp(timestamp);
