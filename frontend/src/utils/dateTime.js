const IST_TIME_ZONE = 'Asia/Kolkata';

const formatterCache = new Map();

const getFormatter = (locale, options) => {
  const key = `${locale}:${JSON.stringify(options)}`;
  const cached = formatterCache.get(key);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat(locale, options);
  formatterCache.set(key, formatter);
  return formatter;
};

const getValidDate = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getOrdinal = (day) => {
  if (day >= 11 && day <= 13) {
    return `${day}th`;
  }

  const lastDigit = day % 10;
  if (lastDigit === 1) {
    return `${day}st`;
  }
  if (lastDigit === 2) {
    return `${day}nd`;
  }
  if (lastDigit === 3) {
    return `${day}rd`;
  }

  return `${day}th`;
};

export const formatRelativeTimestamp = (timestamp, options = {}) => {
  const {
    locale = 'en-IN',
    timeZone = IST_TIME_ZONE,
    month = 'long',
    hour = '2-digit',
    minute = '2-digit',
    hour12 = false,
    lowercaseMonth = true,
    dateOnlyAfterDay = false,
  } = options;

  const created = getValidDate(timestamp);
  if (!created) {
    return '';
  }

  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMinutes < 60) {
    const minutes = Math.max(diffMinutes, 1);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }

  if (dateOnlyAfterDay) {
    return created.toLocaleDateString(locale);
  }

  const dayFormatter = getFormatter(locale, {
    timeZone,
    day: 'numeric',
  });
  const monthFormatter = getFormatter(locale, {
    timeZone,
    month,
  });
  const timeFormatter = getFormatter(locale, {
    timeZone,
    hour,
    minute,
    hour12,
  });

  const day = Number(dayFormatter.format(created));
  const monthValue = monthFormatter.format(created);
  const normalizedMonth = lowercaseMonth ? monthValue.toLowerCase() : monthValue;
  const timeValue = timeFormatter.format(created);

  return `${getOrdinal(day)} ${normalizedMonth} at ${timeValue}`;
};

const getIstDayStamp = (value) => {
  const formatter = getFormatter('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(value);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  return Date.UTC(year, month - 1, day);
};

export const formatVerboseRelativeTime = (timestamp) => {
  const created = getValidDate(timestamp);
  if (!created) {
    return '';
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const now = new Date();
  const days = Math.floor((getIstDayStamp(now) - getIstDayStamp(created)) / dayMs);

  if (days === 0) {
    return 'today';
  }

  if (days < 30) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  const months = Math.floor(days / 30);
  if (days < 365) {
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }

  const years = Math.floor(days / 365);
  const remainingMonths = Math.floor((days % 365) / 30);

  if (remainingMonths > 0) {
    return `${years} year${years === 1 ? '' : 's'}, ${remainingMonths} month${remainingMonths === 1 ? '' : 's'} ago`;
  }

  return `${years} year${years === 1 ? '' : 's'} ago`;
};

export const formatProfileTime = (timestamp) => formatVerboseRelativeTime(timestamp);

export const formatProfileDateHeader = (dateValue, { locale } = {}) => {
  if (!dateValue) {
    return 'Unknown date';
  }

  const date = getValidDate(dateValue);
  if (!date) {
    return String(dateValue);
  }

  const formatter = getFormatter(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return formatter.format(date);
};

export const formatProfileClockTime = (dateValue, { locale } = {}) => {
  if (!dateValue) {
    return '-';
  }

  const date = getValidDate(dateValue);
  if (!date) {
    return '-';
  }

  const formatter = getFormatter(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return formatter.format(date);
};

export const formatHomeQuestionTime = (timestamp) =>
  formatRelativeTimestamp(timestamp, {
    month: 'short',
    hour: 'numeric',
    hour12: true,
  });

export const formatFeedTime = (value) => {
  const date = getValidDate(value);
  if (!date) {
    return '';
  }

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) {
    return `${Math.max(1, minutes)}m ago`;
  }

  const hours = Math.floor(diffMs / 3600000);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(diffMs / 86400000);
  if (days < 30) {
    return `${days}d ago`;
  }

  return date.toLocaleString();
};

export const formatBookmarkTime = (timestamp) => {
  const created = getValidDate(timestamp);
  if (!created) {
    return '';
  }

  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffHours < 24) {
    const hours = Math.max(diffHours, 1);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
};

export const formatProfileTimeWithFallback = (timestamp, formatter) => {
  if (typeof formatter === 'function') {
    return formatter(timestamp);
  }

  return '';
};
