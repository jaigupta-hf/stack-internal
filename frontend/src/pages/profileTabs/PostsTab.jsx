import { useMemo, useState } from 'react';

const ACTIVITY_FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'question', label: 'Question' },
  { key: 'answer', label: 'Answer' },
  { key: 'article', label: 'Article' },
];

function PostsTab({ activities, onOpenReference, formatProfileTime }) {
  const [activityFilterType, setActivityFilterType] = useState('all');

  const filteredActivities = useMemo(() => {
    if (activityFilterType === 'all') {
      return activities;
    }

    return activities.filter(
      (item) => (item.type_key || item.type_label?.toLowerCase()) === activityFilterType,
    );
  }, [activities, activityFilterType]);

  return (
    <section className="rounded-3xl border border-white/10 bg-black/0 p-5">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h3 className="text-sm font-semibold tracking-[0.12em] text-slate-300 uppercase">TOP POSTS</h3>
        <div className='flex flex-wrap gap-2'>
            {ACTIVITY_FILTER_OPTIONS.map((option) => (
            <button
                key={option.key}
                type="button"
                onClick={() => setActivityFilterType(option.key)}
                className={`rounded-sm border px-2.5 py-0.5 text-[11px] font-medium transition ${
                activityFilterType === option.key
                    ? 'border-cyan-300/0 bg-cyan-300/20 text-cyan-200'
                    : 'border-white/0 bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
            >
                {option.label}
            </button>
            ))}
        </div>
      </div>

      {filteredActivities.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No posts yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {filteredActivities.map((item) => (
            <li key={`${item.post_id}-${item.type}`} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                  {item.type_label}
                </span>
                {item.delete_flag ? (
                  <span className="rounded-full border border-rose-300/0 bg-rose-400/20 px-2.5 py-0.5 text-[11px] font-medium text-rose-200">
                    Deleted
                  </span>
                ) : null}
              </div>
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onOpenReference(item)}
                  className={`text-left text-sm font-medium transition hover:underline ${
                    item.delete_flag
                      ? 'text-rose-300 hover:text-rose-200'
                      : 'text-slate-100 hover:text-cyan-200'
                  }`}
                >
                  {item.title}
                </button>
                <span className="shrink-0 text-xs text-slate-400">{formatProfileTime(item.created_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default PostsTab;
