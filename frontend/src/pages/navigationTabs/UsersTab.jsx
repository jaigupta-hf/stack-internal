import { useEffect, useState } from 'react';
import { teamService } from '../../services/api';
import AsyncStateView from '../../components/AsyncStateView';
import useFilteredList from '../../hooks/useFilteredList';

function UsersTab({ team, onOpenUserProfile, canManageUsers = false, currentUserId = null }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenUserId, setMenuOpenUserId] = useState(null);
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await teamService.listTeamUsers(team.id);
        setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load users.');
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [team.id]);

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
      </AsyncStateView>
    </div>
  );
}

export default UsersTab;
