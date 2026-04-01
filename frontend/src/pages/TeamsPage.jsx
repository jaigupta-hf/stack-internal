import { useEffect, useState } from 'react';
import { authService, teamService } from '../services/api';

// Main authenticated workspace screen for team listing and team creation.
function TeamsPage({ user, onLogout, onTeamOpen }) {
  const [teams, setTeams] = useState([]);
  const [name, setName] = useState('');
  const [urlEndpoint, setUrlEndpoint] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch teams where the current user has membership.
  const loadTeams = async () => {
    try {
      const data = await teamService.listTeams();
      setTeams(data);
      setLoadError('');
    } catch (err) {
      setLoadError(err.response?.data?.error || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  // Create a new team, refresh the list, and optionally open it.
  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      const created = await teamService.createTeam({
        name,
        url_endpoint: urlEndpoint,
      });
      setTeams((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
      setUrlEndpoint('');
      setShowCreateModal(false);
      if (onTeamOpen) {
        onTeamOpen(created);
      }
    } catch (err) {
      setFormError('Could not create team. Team name/URL may already exist or URL format is invalid.');
    } finally {
      setSubmitting(false);
    }
  };

  // Invalidate session token on backend/client and return to login state.
  const handleLogout = async () => {
    try {
      await authService.logout();
      onLogout();
    } catch (err) {
      onLogout();
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0b1014] text-slate-100">
      <div className="pointer-events-none absolute -left-20 top-[-120px] h-[380px] w-[380px] rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 bottom-[-120px] h-[420px] w-[420px] rounded-full bg-orange-500/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        {/* Top navigation with logged-in user info and logout action. */}
        <nav className="mb-6 rounded-[1.6rem] border border-white/0 bg-white/5 px-5 py-4 shadow-2xl shadow-black/35 backdrop-blur-xl sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[0.65rem] tracking-[0.16em] text-slate-300 uppercase">
                Team Workspace
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Stack Internal</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="max-w-[220px] truncate rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200">
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                aria-label="Logout"
                title="Logout"
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

        <main className="flex flex-1 items-center justify-center py-3">
          {/* Team listing panel with empty/loading/error states. */}
          <section className="w-full max-w-3xl rounded-[2rem] border border-white/0 bg-white/5 p-6 shadow-2xl shadow-black/35 backdrop-blur-xl sm:p-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-white">Your Teams</h2>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300">
                {teams.length} total
              </span>
            </div>

            {loadError ? (
              <p className="mb-4 rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
                {loadError}
              </p>
            ) : null}
            {loading ? <p className="text-slate-300">Loading teams...</p> : null}
            {!loading && teams.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-8 text-center text-slate-300">
                You have not joined any teams yet.
              </p>
            ) : null}
            {!loading && teams.length > 0 ? (
              <ul className="space-y-3">
                {teams.map((team) => (
                  <li
                    key={team.id}
                    className="group cursor-pointer rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-cyan-300/50 hover:bg-black/30"
                    onClick={() => onTeamOpen && onTeamOpen(team)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-white">{team.name}</p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          team.is_admin
                            ? 'border border-amber-300/0 bg-amber-300/12 text-amber-100'
                            : 'border border-cyan-300/0 bg-cyan-500/10 text-cyan-100'
                        }`}
                      >
                        {team.is_admin ? 'Admin' : 'Member'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-300">/{team.url_endpoint}</p>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-7 flex justify-center">
              <button
                onClick={() => {
                  setFormError('');
                  setShowCreateModal(true);
                }}
                className="rounded-full bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Create New Team
              </button>
            </div>
          </section>
        </main>
      </div>

      {/* Modal form for creating a new team. */}
      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#111821] p-6 shadow-2xl shadow-black/50 sm:p-8">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-semibold text-white">Create New Team</h3>
                <p className="mt-1 text-sm text-slate-300">Set your team name and unique URL endpoint.</p>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormError('');
                }}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-slate-200 transition hover:bg-white/20"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200">Team Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-full border border-white/15 bg-black/20 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                  placeholder="Engineering"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200">URL Endpoint</label>
                <input
                  type="text"
                  value={urlEndpoint}
                  onChange={(e) => setUrlEndpoint(e.target.value)}
                  className="w-full rounded-full border border-white/15 bg-black/20 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                  placeholder="engineering-team"
                  required
                />
                <p className="mt-2 px-1 text-xs text-slate-400">Use lowercase letters, numbers, and hyphens.</p>
              </div>

              {formError ? (
                <p className="rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
                  {formError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Creating...' : 'Create Team'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default TeamsPage;
