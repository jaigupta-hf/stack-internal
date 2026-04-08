import { Suspense, useEffect, useRef } from 'react';
import {
  Navigate,
  Outlet,
  useLocation,
  useMatches,
  useNavigate,
  useParams,
} from 'react-router-dom';
import './App.css';

import { teamService } from './services/api';
import { useAuth } from './context/AuthContext';
import { useTeam } from './context/TeamContext';
import { useUI } from './context/UIContext';

const TABS = ['Home', 'Questions', 'Articles', 'Collections', 'For You', 'Bookmarks', 'Tags', 'Users', 'Admin Settings'];

export const TAB_SLUGS = {
  Home: 'home',
  Questions: 'questions',
  Articles: 'articles',
  Collections: 'collections',
  'For You': 'for-you',
  Bookmarks: 'bookmarks',
  Tags: 'tags',
  Users: 'users',
  'Admin Settings': 'admin-settings',
};

const slugToTab = Object.entries(TAB_SLUGS).reduce((acc, [tab, slug]) => {
  acc[slug] = tab;
  return acc;
}, {});

const buildTeamTabPath = (teamSlug, tab) => {
  const tabSlug = TAB_SLUGS[tab] || TAB_SLUGS.Home;
  return `/${teamSlug}/${tabSlug}`;
};

const getProfileReturnTabSlug = (search) => {
  const value = new URLSearchParams(search).get('from');
  return value || TAB_SLUGS.Home;
};

const TabIcon = ({ tab }) => {
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
};

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const matches = useMatches();
  const { teamSlug = '' } = useParams();
  const { user, loading, setUser } = useAuth();
  const {
    activeTeam,
    setActiveTeam,
    activeTab,
    setActiveTab,
    isTeamMember,
    setIsTeamMember,
    isTeamAdmin,
    setIsTeamAdmin,
    joiningTeam,
    setJoiningTeam,
    joinTeamError,
    setJoinTeamError,
    joinedTeams,
    setJoinedTeams,
    loadingJoinedTeams,
    forYouUnreadCount,
    setForYouUnreadCount,
    currentTeamReputation,
  } = useTeam();
  const {
    teamSwitcherOpen,
    setTeamSwitcherOpen,
    globalSearchQuery,
    setGlobalSearchQuery,
    globalSearchResults,
    setGlobalSearchResults,
    globalSearchLoading,
    globalSearchError,
    setGlobalSearchError,
    globalSearchOpen,
    setGlobalSearchOpen,
  } = useUI();
  const teamSwitcherRef = useRef(null);
  const globalSearchRef = useRef(null);

  const routeTab = [...matches].reverse().find((match) => match.handle?.tab)?.handle?.tab || null;
  const navSelectedTab = routeTab && routeTab !== 'Profile' ? routeTab : activeTab;

  const resetTeamScope = () => {
    setActiveTeam(null);
    setActiveTab('Home');
    setIsTeamMember(true);
    setIsTeamAdmin(false);
    setJoinTeamError('');
    setForYouUnreadCount(0);
  };

  const pushTeamTabUrl = (team, tab, { replace = false } = {}) => {
    if (!team?.url_endpoint) {
      return;
    }

    const nextPath = buildTeamTabPath(team.url_endpoint, tab);
    if (location.pathname !== nextPath) {
      navigate(nextPath, { replace });
    }
  };

  const setProfileInUrl = (profileValue, fromTabSlug, replace = false) => {
    if (!activeTeam?.url_endpoint) {
      return;
    }

    const profileSegment =
      profileValue === null || profileValue === undefined || profileValue === '' || profileValue === 'me'
        ? 'me'
        : String(profileValue);

    const searchParams = new URLSearchParams();
    if (fromTabSlug) {
      searchParams.set('from', fromTabSlug);
    }

    const search = searchParams.toString();
    navigate(
      {
        pathname: `/${activeTeam.url_endpoint}/users/${profileSegment}`,
        search: search ? `?${search}` : '',
      },
      { replace },
    );
  };

  const hydrateTeamFromRoute = async (teamSlugFromRoute, desiredTab) => {
    const data = await teamService.getTeamBySlug(teamSlugFromRoute);
    const teamFromPath = {
      id: data.id,
      name: data.name,
      url_endpoint: data.url_endpoint,
    };

    const nextTab = data.is_member && (data.is_admin || desiredTab !== 'Admin Settings')
      ? desiredTab
      : 'Home';

    setActiveTeam(teamFromPath);
    setIsTeamMember(data.is_member);
    setIsTeamAdmin(data.is_admin);
    setJoinTeamError('');
    setActiveTab(nextTab);

    const canonicalPath = buildTeamTabPath(teamFromPath.url_endpoint, nextTab);
    if (routeTab !== 'Profile' && location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true });
    }
  };

  useEffect(() => {
    if (!teamSwitcherOpen) {
      return;
    }

    const handleOutsideClick = (event) => {
      if (!teamSwitcherRef.current?.contains(event.target)) {
        setTeamSwitcherOpen(false);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [teamSwitcherOpen, setTeamSwitcherOpen]);

  useEffect(() => {
    if (!globalSearchOpen) {
      return;
    }

    const handleOutsideClick = (event) => {
      if (!globalSearchRef.current?.contains(event.target)) {
        setGlobalSearchOpen(false);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [globalSearchOpen, setGlobalSearchOpen]);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (!teamSlug) {
      resetTeamScope();
      return;
    }

    const nextTab = routeTab && routeTab !== 'Profile' ? routeTab : activeTab || 'Home';

    const syncTeamFromRoute = async () => {
      if (activeTeam?.url_endpoint === teamSlug) {
        if (routeTab && routeTab !== 'Profile') {
          setActiveTab(routeTab);
        }

        if (routeTab !== 'Profile' && (!isTeamMember || (nextTab === 'Admin Settings' && !isTeamAdmin))) {
          pushTeamTabUrl(activeTeam, 'Home', { replace: true });
        }
        return;
      }

      try {
        await hydrateTeamFromRoute(teamSlug, nextTab);
      } catch {
        resetTeamScope();
        navigate('/', { replace: true });
      }
    };

    syncTeamFromRoute();
  }, [
    user,
    teamSlug,
    routeTab,
    activeTab,
    activeTeam?.url_endpoint,
    isTeamMember,
    isTeamAdmin,
    setActiveTab,
    setActiveTeam,
    setIsTeamAdmin,
    setIsTeamMember,
    setJoinTeamError,
    navigate,
  ]);

  const handleLogout = () => {
    resetTeamScope();
    setTeamSwitcherOpen(false);
    setUser(null);
    navigate('/', { replace: true });
  };

  const handleTeamOpen = (team) => {
    setActiveTeam(team);
    setActiveTab('Home');
    setIsTeamMember(true);
    setIsTeamAdmin(Boolean(team.is_admin));
    setJoinTeamError('');
    setForYouUnreadCount(0);
    setTeamSwitcherOpen(false);
    setJoinedTeams((prev) => {
      if (prev.some((item) => item.id === team.id)) {
        return prev;
      }
      return [...prev, team].sort((a, b) => a.name.localeCompare(b.name));
    });
    pushTeamTabUrl(team, 'Home');
  };

  const handleTabChange = (tab) => {
    if (!isTeamMember || (tab === 'Admin Settings' && !isTeamAdmin)) {
      return;
    }

    setActiveTab(tab);
    if (activeTeam) {
      pushTeamTabUrl(activeTeam, tab);
    }
  };

  const handleBackToTeams = () => {
    resetTeamScope();
    setTeamSwitcherOpen(false);
    navigate('/', { replace: true });
  };

  const handleOpenSelfProfile = () => {
    const fromTabSlug = TAB_SLUGS[navSelectedTab] || TAB_SLUGS.Home;
    setProfileInUrl('me', fromTabSlug);
  };

  const handleOpenQuestionFromHome = (questionId) => {
    if (!activeTeam?.url_endpoint || !questionId) {
      return;
    }

    setActiveTab('Questions');
    navigate(`/${activeTeam.url_endpoint}/questions?question=${questionId}`);
  };

  const handleOpenUserProfile = (selectedUserId) => {
    const fromTabSlug = TAB_SLUGS[navSelectedTab] || TAB_SLUGS.Home;
    setProfileInUrl(selectedUserId, fromTabSlug);
  };

  const handleCloseProfilePage = () => {
    if (!activeTeam?.url_endpoint) {
      return;
    }

    const returnTabSlug = getProfileReturnTabSlug(location.search);
    const returnTab = slugToTab[returnTabSlug] || 'Home';
    setActiveTab(returnTab);
    navigate(`/${activeTeam.url_endpoint}/${returnTabSlug}`, { replace: true });
  };

  const handleSelectGlobalSearchResult = (item) => {
    if (!activeTeam?.url_endpoint || !item?.id) {
      return;
    }

    let nextTab = 'Questions';
    let nextPath = `/${activeTeam.url_endpoint}/questions?question=${item.id}`;

    if (item.type === 'article') {
      nextTab = 'Articles';
      nextPath = `/${activeTeam.url_endpoint}/articles?article=${item.id}`;
    } else if (item.type === 'collection') {
      nextTab = 'Collections';
      nextPath = `/${activeTeam.url_endpoint}/collections?collection=${item.id}`;
    }

    setActiveTab(nextTab);
    navigate(nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
    setGlobalSearchQuery('');
    setGlobalSearchResults([]);
    setGlobalSearchError('');
    setGlobalSearchOpen(false);
  };

  const handleJoinTeam = async () => {
    if (!activeTeam) {
      return;
    }

    setJoiningTeam(true);
    setJoinTeamError('');

    try {
      await teamService.joinTeam(activeTeam.id);
      setIsTeamMember(true);
      setIsTeamAdmin(false);
      setActiveTab('Home');
      pushTeamTabUrl(activeTeam, 'Home');
    } catch (err) {
      setJoinTeamError(err.response?.data?.error || 'Failed to join team.');
    } finally {
      setJoiningTeam(false);
    }
  };

  const handleOpenNotificationReference = (item) => {
    if (!activeTeam?.url_endpoint || !item?.post_id) {
      return;
    }

    let nextTab = 'Questions';
    let targetId = item.post_id;
    let nextPath = `/${activeTeam.url_endpoint}/questions?question=${targetId}`;

    if (item.post_type === 1) {
      targetId = item.parent_post_id || item.post_id;
      nextPath = `/${activeTeam.url_endpoint}/questions?question=${targetId}`;
    } else if ([20, 21, 22, 23].includes(item.post_type)) {
      nextTab = 'Articles';
      nextPath = `/${activeTeam.url_endpoint}/articles?article=${targetId}`;
    }

    setActiveTab(nextTab);
    navigate(nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleOpenBookmarkReference = (item) => {
    if (!activeTeam?.url_endpoint) {
      return;
    }

    let nextTab = 'Collections';
    let nextPath = `/${activeTeam.url_endpoint}/collections`;

    if (item.post_id) {
      const postType = Number(item.post_type);
      if (postType === 0 || postType === 1) {
        nextTab = 'Questions';
        const questionId = postType === 1 ? item.parent_post_id || item.post_id : item.post_id;
        nextPath = `/${activeTeam.url_endpoint}/questions?question=${questionId}`;
      } else {
        nextTab = 'Articles';
        nextPath = `/${activeTeam.url_endpoint}/articles?article=${item.post_id}`;
      }
    } else if (item.collection_id) {
      nextTab = 'Collections';
      nextPath = `/${activeTeam.url_endpoint}/collections?collection=${item.collection_id}`;
    }

    setActiveTab(nextTab);
    navigate(nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-xl text-slate-200">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!activeTeam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-xl text-slate-200">Loading team...</div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#0b1014] text-slate-100">
      <div className="relative mx-auto flex h-screen w-full max-w-[92rem] flex-col overflow-hidden px-3 py-2 sm:px-4 lg:px-8">
        <nav className="relative z-50 mb-3 overflow-visible rounded-3xl border border-white/0 bg-white/5 px-4 py-4 shadow-2xl shadow-black/35 backdrop-blur-xl sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold text-white sm:text-3xl">Stack Internal</h1>
                <div className="relative" ref={teamSwitcherRef}>
                  <button
                    type="button"
                    onClick={() => setTeamSwitcherOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-md border border-white/0 bg-white/10 px-4 py-1 text-[0.65rem] tracking-[0.16em] text-slate-200 uppercase transition hover:bg-white/15"
                  >
                    <span className="max-w-[220px] truncate">{activeTeam.name}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden="true">
                      <path d={teamSwitcherOpen ? 'm6 14 6-6 6 6' : 'm6 10 6 6 6-6'} />
                    </svg>
                  </button>

                  {teamSwitcherOpen ? (
                    <div className="absolute left-0 top-full z-[90] mt-2 w-50 overflow-hidden rounded-2xl border border-white/10 bg-[#0f141c] p-2 shadow-2xl shadow-black/50">
                      <p className="px-2 pb-1 text-[10px] tracking-[0.10em] text-slate-400 uppercase">Joined teams</p>

                      {loadingJoinedTeams ? <p className="px-2 py-2 text-xs text-slate-400">Loading teams...</p> : null}

                      {!loadingJoinedTeams && joinedTeams.length === 0 ? (
                        <p className="px-2 py-2 text-xs text-slate-400">No joined teams found.</p>
                      ) : null}

                      {!loadingJoinedTeams && joinedTeams.length > 0 ? (
                        <ul className="max-h-56 space-y-1 overflow-y-auto">
                          {joinedTeams.map((team) => (
                            <li key={team.id}>
                              <button
                                type="button"
                                onClick={() => handleTeamOpen(team)}
                                className={`w-full rounded-3xl px-3 py-1 text-left text-[0.65rem] tracking-[0.16em] uppercase transition ${
                                  activeTeam?.id === team.id
                                    ? 'bg-cyan-500/20 text-cyan-300'
                                    : 'text-slate-200 hover:bg-white/10'
                                }`}
                              >
                                <span className="block truncate">{team.name}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      <div className="mt-1 border-t border-white/10 pt-2">
                        <button
                          type="button"
                          onClick={handleBackToTeams}
                          className="w-full rounded-3xl px-3 py-1 text-left text-[10px] tracking-[0.12em] text-slate-200 uppercase transition hover:bg-white/10"
                        >
                          Go to teams listing
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="relative w-full sm:max-w-xl" ref={globalSearchRef}>
              <input
                type="text"
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                onFocus={() => {
                  if (globalSearchQuery.trim()) {
                    setGlobalSearchOpen(true);
                  }
                }}
                className="w-full rounded-full border border-white/15 bg-black/20 px-4 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                placeholder="Search questions, articles, collections by title"
              />

              {globalSearchOpen && globalSearchQuery.trim() ? (
                <div className="absolute left-0 right-0 top-full z-[95] mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#0f141c] p-2 shadow-2xl shadow-black/50">
                  {globalSearchLoading ? (
                    <p className="px-2 py-2 text-xs text-slate-400">Searching...</p>
                  ) : null}

                  {!globalSearchLoading && globalSearchError ? (
                    <p className="px-2 py-2 text-xs text-rose-300">{globalSearchError}</p>
                  ) : null}

                  {!globalSearchLoading && !globalSearchError && globalSearchResults.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-slate-400">No results found.</p>
                  ) : null}

                  {!globalSearchLoading && !globalSearchError && globalSearchResults.length > 0 ? (
                    <ul className="max-h-72 space-y-1 overflow-y-auto">
                      {globalSearchResults.map((item) => (
                        <li key={`${item.type}-${item.id}`}>
                          <div className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/10">
                            <button
                              type="button"
                              onClick={() => handleSelectGlobalSearchResult(item)}
                              className="w-full truncate text-left text-sm text-slate-100"
                            >
                              {item.title}
                            </button>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {item.type} •{' '}
                              <button
                                type="button"
                                onClick={() => handleOpenUserProfile(item.user_id || item.user)}
                                className="font-medium text-slate-300 transition hover:text-cyan-200 hover:underline"
                              >
                                {item.user_name}
                              </button>
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleOpenSelfProfile}
                className="max-w-[220px] truncate rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
              >
                {user.name}
                {typeof currentTeamReputation === 'number' ? ` • ${currentTeamReputation}` : ''}
              </button>
              <button
                onClick={handleLogout}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/0 bg-white/10 text-white transition hover:bg-white/20"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
                  <path d="M10 5H5v14h5" />
                  <path d="M14 17l5-5-5-5" />
                  <path d="M19 12H7" />
                </svg>
              </button>
            </div>
          </div>
        </nav>

        <main className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-3xl border border-white/0 bg-white/5 p-3 shadow-2xl shadow-black/35 backdrop-blur-xl sm:p-5">
            <p className="px-2 pb-3 text-xs tracking-[0.14em] text-slate-400 uppercase">Navigation</p>
            <div className="space-y-2">
              {TABS.filter((tab) => (tab === 'Admin Settings' ? isTeamAdmin : true)).map((tab) => {
                const selected = navSelectedTab === tab;
                return (
                  <div key={tab}>
                    <button
                      onClick={() => handleTabChange(tab)}
                      disabled={!isTeamMember}
                      className={
                        selected
                          ? 'w-full rounded-md bg-cyan-300/15 px-4 py-1.5 text-left text-sm font-semibold text-cyan-100'
                          : `w-full rounded-md px-4 py-1.5 text-left text-sm font-medium transition ${
                              isTeamMember
                                ? 'text-slate-200 hover:border-white/25 hover:bg-white/10'
                                : 'cursor-not-allowed text-slate-500'
                            }`
                      }
                    >
                      <span className="flex items-center gap-2.5">
                        <span className={selected ? 'text-cyan-200' : 'text-slate-400'}>
                          <TabIcon tab={tab} />
                        </span>
                        <span>{tab}</span>
                        {tab === 'For You' && forYouUnreadCount > 0 ? (
                          <span className="ml-auto rounded-full border border-cyan-300/0 bg-cyan-300/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                            {forYouUnreadCount}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {tab === 'Home' ? <div className="mt-6 border-t border-white/35" /> : null}
                    {tab === 'Collections' ? <div className="mt-6 border-t border-white/35" /> : null}
                    {tab === 'Tags' ? <div className="mt-6 border-t border-white/35" /> : null}
                    {tab === 'Users' ? <div className="mt-6 border-t border-white/35" /> : null}
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto rounded-3xl border border-white/0 bg-white/5 p-4 shadow-2xl shadow-black/35 backdrop-blur-xl sm:p-5">
            {!isTeamMember ? (
              <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-white/0 bg-black/20 p-8 text-center">
                <p className="text-xs tracking-[0.14em] text-slate-400 uppercase">Team Access</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Join {activeTeam.name}</h2>
                <p className="mt-3 text-sm text-slate-300">
                  You are not a member of this company yet. Join to access questions, tags, users, and other team content.
                </p>

                {joinTeamError ? (
                  <p className="mt-4 rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
                    {joinTeamError}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={handleJoinTeam}
                  disabled={joiningTeam}
                  className="mt-6 rounded-full bg-cyan-400 px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {joiningTeam ? 'Joining...' : 'Join Team'}
                </button>
              </div>
            ) : (
              <Suspense fallback={<p className="text-slate-300">Loading section...</p>}>
                <Outlet
                  context={{
                    onOpenQuestion: handleOpenQuestionFromHome,
                    onOpenUserProfile: handleOpenUserProfile,
                    onOpenNotificationReference: handleOpenNotificationReference,
                    onOpenBookmarkReference: handleOpenBookmarkReference,
                    onCloseProfile: handleCloseProfilePage,
                  }}
                />
              </Suspense>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
