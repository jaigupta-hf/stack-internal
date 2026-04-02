export const formatProfileTime = (timestamp) => {
  const created = new Date(timestamp);
  if (Number.isNaN(created.getTime())) {
    return '';
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const getIstDayStamp = (value) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);

    const year = Number(parts.find((part) => part.type === 'year')?.value);
    const month = Number(parts.find((part) => part.type === 'month')?.value);
    const day = Number(parts.find((part) => part.type === 'day')?.value);

    return Date.UTC(year, month - 1, day);
  };

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
