function TabIcon({ tab }) {
  if (tab === 'Home') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5.5 9.5V21h13V9.5" />
      </svg>
    );
  }

  if (tab === 'Questions') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.9.8-1.7 1.2-1.7 2.2" />
        <circle cx="12" cy="16.8" r=".7" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (tab === 'Articles') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 9h8M8 12h8M8 15h5" />
      </svg>
    );
  }

  if (tab === 'Collections') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <rect x="3.5" y="6" width="8" height="12" rx="1.5" />
        <rect x="12.5" y="6" width="8" height="12" rx="1.5" />
      </svg>
    );
  }

  if (tab === 'For You') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="m12 20-6.6-6.2a4.2 4.2 0 1 1 5.9-6l.7.8.7-.8a4.2 4.2 0 1 1 5.9 6Z" />
      </svg>
    );
  }

  if (tab === 'Bookmarks') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M6 4.5h12v15L12 16l-6 3.5z" />
      </svg>
    );
  }

  if (tab === 'Tags') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M20 12.4 11.6 4H5v6.6l8.4 8.4a1.8 1.8 0 0 0 2.6 0l4-4a1.8 1.8 0 0 0 0-2.6Z" />
        <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (tab === 'Users') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <circle cx="12" cy="8" r="3" />
        <path d="M5 19a7 7 0 0 1 14 0" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M12 3v18M3 12h18" />
    </svg>
  );
}

export default TabIcon;
