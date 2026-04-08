import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { postService } from '../services/api';
import { useTeam } from './TeamContext';

const UIContext = createContext(undefined);

export function UIProvider({ children }) {
  const { activeTeam } = useTeam();

  const [teamSwitcherOpen, setTeamSwitcherOpen] = useState(false);
  const [showProfilePage, setShowProfilePage] = useState(false);
  const [profileUserId, setProfileUserId] = useState(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchError, setGlobalSearchError] = useState('');
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);

  useEffect(() => {
    const query = globalSearchQuery.trim();
    if (!activeTeam?.id || !query) {
      setGlobalSearchResults([]);
      setGlobalSearchLoading(false);
      setGlobalSearchError('');
      return;
    }

    const debounce = setTimeout(async () => {
      setGlobalSearchLoading(true);
      setGlobalSearchError('');

      try {
        const data = await postService.searchGlobalTitles(activeTeam.id, query);
        setGlobalSearchResults(data || []);
        setGlobalSearchOpen(true);
      } catch (err) {
        setGlobalSearchResults([]);
        setGlobalSearchError(err.response?.data?.error || 'Failed to search.');
      } finally {
        setGlobalSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(debounce);
  }, [activeTeam?.id, globalSearchQuery]);

  const value = useMemo(() => ({
    teamSwitcherOpen,
    setTeamSwitcherOpen,
    showProfilePage,
    setShowProfilePage,
    profileUserId,
    setProfileUserId,
    globalSearchQuery,
    setGlobalSearchQuery,
    globalSearchResults,
    setGlobalSearchResults,
    globalSearchLoading,
    setGlobalSearchLoading,
    globalSearchError,
    setGlobalSearchError,
    globalSearchOpen,
    setGlobalSearchOpen,
  }), [
    teamSwitcherOpen,
    showProfilePage,
    profileUserId,
    globalSearchQuery,
    globalSearchResults,
    globalSearchLoading,
    globalSearchError,
    globalSearchOpen,
  ]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within UIProvider');
  }

  return context;
}
