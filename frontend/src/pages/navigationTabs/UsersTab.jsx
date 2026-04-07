import { useCallback, useEffect, useState } from 'react';
import { teamService } from '../../services/api';
import AsyncStateView from '../../components/AsyncStateView';
import useFilteredList from '../../hooks/useFilteredList';
import useTeamResource from '../../hooks/useTeamResource';

const DEFAULT_USERS_PAGE_SIZE = 24;
const USERS_PAGE_SIZE_OPTIONS = [12, 24, 48];

const getVisiblePageNumbers = (pagination, windowSize = 5) => {
  const totalPages = Math.max(pagination?.total_pages || 1, 1);
  const currentPage = Math.min(Math.max(pagination?.page || 1, 1), totalPages);
  const halfWindow = Math.floor(windowSize / 2);

  let startPage = Math.max(currentPage - halfWindow, 1);
  let endPage = Math.min(startPage + windowSize - 1, totalPages);

  if (endPage - startPage + 1 < windowSize) {
    startPage = Math.max(endPage - windowSize + 1, 1);
  }

  const pages = [];
  for (let page = startPage; page <= endPage; page += 1) {
    pages.push(page);
  }

  return pages;
};

function UsersTab({ team, onOpenUserProfile, canManageUsers = false, currentUserId = null }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenUserId, setMenuOpenUserId] = useState(null);
  const [actionLoading, setActionLoading] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(DEFAULT_USERS_PAGE_SIZE);
  const [usersPagination, setUsersPagination] = useState(null);

  useEffect(() => {
    setUsersPage(1);
  }, [team?.id]);

  const loadUsers = useCallback(async () => {
    const payload = await teamService.listTeamUsersPage(team?.id, {
      page: usersPage,
      pageSize: usersPageSize,
    });

    setUsersPagination(payload?.pagination ?? null);
    return Array.isArray(payload?.items) ? payload.items : [];
  }, [team?.id, usersPage, usersPageSize]);

  const {
    data: users,
    setData: setUsers,
    loading,
    error,
    setError,
  } = useTeamResource({
    enabled: Boolean(team?.id),
    initialData: [],
    loadResource: loadUsers,
    fallbackErrorMessage: 'Failed to load users.',
    dependencies: [team?.id, usersPage, usersPageSize],
  });

  const handlePreviousPage = () => {
    setUsersPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setUsersPage((prev) => {
      if (usersPagination && !usersPagination.has_next) {
        return prev;
      }
      return prev + 1;
    });
  };

  const handleGoToPage = (page) => {
    if (!usersPagination) {
      return;
    }

    const maxPage = Math.max(usersPagination.total_pages || 1, 1);
    const nextPage = Math.min(Math.max(page, 1), maxPage);
    setUsersPage(nextPage);
  };

  const handlePageSizeChange = (value) => {
    const nextPageSize = Number(value);
    if (!Number.isFinite(nextPageSize) || nextPageSize <= 0) {
      return;
    }

    setUsersPageSize(nextPageSize);
    setUsersPage(1);
  };

  const visibleUsers = useFilteredList(users, (source) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return source;
    }

    return source.filter((member) => {
      const name = (member.name || '').toLowerCase();
      const email = (member.email || '').toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [searchQuery]);

  const usersEmptyMessage = users.length === 0
    ? 'No users found in this team.'
    : 'No users match your search.';

  const handleToggleAdminRole = async (member) => {
    if (!canManageUsers) {
      return;
    }

    try {
      const actionKey = member.is_admin ? `make-member:${member.id}` : `make-admin:${member.id}`;
      setActionLoading(actionKey);
      setError('');

      if (member.is_admin) {
        await teamService.makeTeamMember(team.id, member.id);
      } else {
        await teamService.makeTeamAdmin(team.id, member.id);
      }

      setUsers((prev) =>
        prev.map((item) =>
          item.id === member.id
            ? { ...item, is_admin: !member.is_admin }
            : item
        )
      );
      setMenuOpenUserId(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user role.');
    } finally {
      setActionLoading('');
    }
  };

  const handleRemoveUser = async (member) => {
    if (!canManageUsers) {
      return;
    }

    try {
      setActionLoading(`remove-user:${member.id}`);
      setError('');
      await teamService.removeTeamUser(team.id, member.id);
      setUsers((prev) => prev.filter((item) => item.id !== member.id));
      setMenuOpenUserId(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove user.');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold text-white">Users</h2>
      <p className="mt-2 text-slate-300">Team members in this workspace.</p>

      <div className="mt-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md rounded-full border border-white/15 bg-black/20 px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
          placeholder="Search users by name or email"
        />
      </div>

      <AsyncStateView
        loading={loading}
        error={error}
        isEmpty={visibleUsers.length === 0}
        loadingMessage="Loading users..."
        emptyMessage={usersEmptyMessage}
        loadingClassName="mt-6 text-slate-300"
        errorClassName="mt-4 rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200"
        emptyClassName="mt-6 rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-10 text-center text-slate-400"
      >
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleUsers.map((member) => (
            <article
              key={member.id}
              className="relative rounded-xl border border-white/15 bg-black/20 px-4 py-3"
            >
              {canManageUsers && member.id !== currentUserId ? (
                <div className="absolute top-2 right-2">
                  <button
                    type="button"
                    onClick={() => setMenuOpenUserId((prev) => (prev === member.id ? null : member.id))}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/15"
                    aria-label="User actions"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                      <circle cx="12" cy="5" r="1.8" />
                      <circle cx="12" cy="12" r="1.8" />
                      <circle cx="12" cy="19" r="1.8" />
                    </svg>
                  </button>

                  {menuOpenUserId === member.id ? (
                    <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-white/15 bg-[#0f141c] shadow-lg shadow-black/40">
                      <button
                        type="button"
                        onClick={() => handleToggleAdminRole(member)}
                        disabled={actionLoading === `make-member:${member.id}` || actionLoading === `make-admin:${member.id}` || actionLoading === `remove-user:${member.id}`}
                        className="block w-full px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionLoading === `make-admin:${member.id}`
                          ? 'Making admin...'
                          : actionLoading === `make-member:${member.id}`
                            ? 'Making member...'
                            : member.is_admin
                              ? 'Make member'
                              : 'Make admin'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveUser(member)}
                        disabled={actionLoading === `remove-user:${member.id}` || actionLoading === `make-admin:${member.id}`}
                        className="block w-full px-3 py-2 text-left text-xs text-rose-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionLoading === `remove-user:${member.id}` ? 'Removing...' : 'Remove user'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <button
                  type="button"
                  onClick={() => onOpenUserProfile?.(member.id)}
                  className="truncate text-left transition hover:text-cyan-200 hover:underline"
                >
                  {member.name}
                </button>
                {member.is_admin ? (
                  <span className="rounded-full border border-amber-300/40 bg-amber-400/20 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-xs text-amber-100">
                    Admin
                  </span>
                ) : null}
              </p>
              <p className="mt-1 truncate text-xs text-slate-400">{member.email}</p>
            </article>
          ))}
        </div>

        {!loading && !error && usersPagination ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-xs text-slate-300">
              Page {usersPagination.page} of {Math.max(usersPagination.total_pages || 1, 1)}
              {' '}•{' '}Total {usersPagination.total_items ?? users.length} users
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <span>Per page</span>
                <select
                  value={usersPageSize}
                  onChange={(e) => handlePageSizeChange(e.target.value)}
                  className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-xs text-slate-100 outline-none"
                >
                  {USERS_PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={`users-page-size-${option}`} value={option} className="bg-[#111821] text-slate-100">
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={handlePreviousPage}
                disabled={!usersPagination.has_previous}
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={!usersPagination.has_next}
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Next
              </button>

              {getVisiblePageNumbers(usersPagination).map((page) => (
                <button
                  key={`users-page-${page}`}
                  type="button"
                  onClick={() => handleGoToPage(page)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    page === usersPagination.page
                      ? 'border-cyan-300/0 bg-cyan-300/20 text-cyan-100'
                      : 'border-white/15 bg-white/10 text-slate-200 hover:bg-white/20'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </AsyncStateView>
    </div>
  );
}

export default UsersTab;
