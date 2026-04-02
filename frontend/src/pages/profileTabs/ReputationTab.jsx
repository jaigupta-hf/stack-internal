import { useEffect, useMemo, useState } from 'react';
import { reputationService } from '../../services/api';

function formatDateHeader(dateValue) {
  if (!dateValue) {
    return 'Unknown date';
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(dateValue) {
  if (!dateValue) {
    return '-';
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPointsClass(points) {
  if (points > 0) {
    return 'text-emerald-300';
  }
  if (points < 0) {
    return 'text-rose-300';
  }
  return 'text-slate-300';
}

function ReputationTab({ team, profileUserId, onOpenReference }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadReputationHistory = async () => {
      if (!team?.id || !profileUserId) {
        setGroups([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const payload = await reputationService.listHistory(team.id, profileUserId);
        setGroups(Array.isArray(payload?.groups) ? payload.groups : []);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load reputation history.');
      } finally {
        setLoading(false);
      }
    };

    loadReputationHistory();
  }, [team?.id, profileUserId]);

  const totalPoints = useMemo(
    () => groups.reduce((sum, group) => sum + Number(group?.total_points || 0), 0),
    [groups],
  );

  if (loading) {
    return <p className="text-sm text-slate-300">Loading reputation history...</p>;
  }

  if (error) {
    return (
      <p className="rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
        {error}
      </p>
    );
  }

  return (
    <section className="space-y-4">

      {!groups.length ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-black/15 px-4 py-5 text-sm text-slate-400">
          No reputation history available yet.
        </div>
      ) : null}

      {groups.map((group) => {
        const dateLabel = formatDateHeader(group.date);
        const groupTotal = Number(group.total_points || 0);
        const items = Array.isArray(group.items) ? group.items : [];

        return (
          <article key={group.date} className="rounded-3xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <h3 className="text-sm font-semibold text-white">{dateLabel}</h3>
              <span className={`text-xs font-medium ${getPointsClass(groupTotal)}`}>
                {groupTotal > 0 ? `+${groupTotal}` : groupTotal}
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {items.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/5 bg-black/20 px-3 py-2"
                >
                  <span className="shrink-0 whitespace-nowrap text-xs text-slate-300">{entry.reason}</span>

                  <span className={`shrink-0 whitespace-nowrap text-xs font-semibold ${getPointsClass(Number(entry.points || 0))}`}>
                    {Number(entry.points || 0) > 0 ? `+${entry.points}` : entry.points}
                  </span>

                  <button
                    type="button"
                    onClick={() => onOpenReference?.(entry)}
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-100 transition hover:text-cyan-200 hover:underline"
                    title={entry.post_title || 'Untitled post'}
                  >
                    {entry.post_title || 'Untitled post'}
                  </button>

                  <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400">{formatTime(entry.created_at)}</span>
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </section>
  );
}

export default ReputationTab;
