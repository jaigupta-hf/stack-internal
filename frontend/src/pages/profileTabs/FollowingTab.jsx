import { useEffect, useState } from 'react';
import { postService } from '../../services/api';
import AsyncStateView from '../../components/AsyncStateView';

const formatFollowTime = (timestamp, formatProfileTime) => {
  if (typeof formatProfileTime === 'function') {
    return formatProfileTime(timestamp);
  }

  return '';
};

function FollowingTab({ team, profileUserId, canEdit, formatProfileTime, onOpenReference, onOpenUserProfile }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadFollowedPosts = async () => {
      if (!team?.id || !profileUserId) {
        setItems([]);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const data = await postService.listFollowedPosts(team.id, profileUserId);
        setItems(data || []);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load followed posts.');
      } finally {
        setLoading(false);
      }
    };

    loadFollowedPosts();
  }, [team?.id, profileUserId]);

  const handleOpenPost = (item) => {
    onOpenReference?.({
      reference_type: 'question',
      reference_post_id: item.post_id,
    });
  };

  const handleUnfollow = async (item) => {
    if (!canEdit) {
      return;
    }

    try {
      await postService.unfollowQuestion(item.post_id);
      setItems((prev) => prev.filter((entry) => entry.follow_id !== item.follow_id));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to unfollow question.');
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-black/0 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-[0.12em] text-slate-300 uppercase">FOLLOWING</h3>
        <p className="text-xs text-slate-400">Questions this user follows</p>
      </div>

      <AsyncStateView
        loading={loading}
        error={error}
        isEmpty={items.length === 0}
        loadingMessage="Loading followed posts..."
        emptyMessage="No followed posts yet."
        loadingClassName="mt-6 text-slate-300"
        errorClassName="mt-4 rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200"
        emptyClassName="mt-6 rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-10 text-center text-slate-400"
      >
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.follow_id} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-slate-100">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                    Question
                  </span>
                  <span className="rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                    {item.answer_count || 0} answers
                  </span>
                  {item.is_closed ? (
                    <span className="rounded-full border border-rose-300/30 bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-medium text-rose-200">
                      Closed
                    </span>
                  ) : null}
                  {item.delete_flag ? (
                    <span className="rounded-full border border-rose-300/30 bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-medium text-rose-200">
                      Deleted
                    </span>
                  ) : null}
                </div>

                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => handleUnfollow(item)}
                    className="rounded-full border border-amber-300/70 bg-amber-400/20 px-3 py-1 text-xs font-medium text-amber-100 transition hover:bg-amber-400/30"
                  >
                    Unfollow
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => handleOpenPost(item)}
                className={`mt-2 text-left text-base font-semibold transition hover:underline ${
                  item.delete_flag ? 'text-rose-300 hover:text-rose-200' : 'text-slate-100 hover:text-cyan-200'
                }`}
              >
                {item.title || 'Untitled question'}
              </button>

              <p
                className={`mt-1 text-sm ${item.delete_flag ? 'text-rose-300/80' : 'text-slate-300'}`}
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {item.body || ''}
              </p>

              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="min-w-0 flex flex-wrap gap-2">
                  {(item.tags || []).map((tag) => (
                    <span
                      key={tag.id || tag.name}
                      className={`rounded-sm border px-2.5 py-0.5 text-[11px] font-medium ${
                        item.delete_flag
                          ? 'border-rose-300/30 bg-rose-400/10 text-rose-200'
                          : 'border-cyan-300/0 bg-cyan-300/10 text-cyan-400'
                      }`}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
                <p className="shrink-0 text-right text-xs text-slate-400">
                  <span>
                    <button
                      type="button"
                      onClick={() => onOpenUserProfile?.(item.user_id)}
                      className="font-medium text-slate-300 transition hover:text-cyan-200 hover:underline"
                    >
                      {item.user_name}
                    </button>{' '}
                    asked {formatFollowTime(item.created_at, formatProfileTime)}
                  </span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </AsyncStateView>
    </section>
  );
}

export default FollowingTab;
