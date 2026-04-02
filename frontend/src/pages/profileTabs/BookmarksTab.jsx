import { useEffect, useState } from 'react';
import { postService } from '../../services/api';

const formatBookmarkTime = (timestamp, formatProfileTime) => {
  if (typeof formatProfileTime === 'function') {
    return formatProfileTime(timestamp);
  }

  return '';
};

function BookmarksTab({ team, profileUserId, canEdit, formatProfileTime, onOpenReference, onOpenUserProfile }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadBookmarks = async () => {
      if (!team?.id || !profileUserId) {
        setBookmarks([]);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const data = await postService.listBookmarks(team.id, profileUserId);
        setBookmarks(data || []);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load bookmarks.');
      } finally {
        setLoading(false);
      }
    };

    loadBookmarks();
  }, [team?.id, profileUserId]);

  const handleRemoveBookmark = async (item) => {
    if (!canEdit) {
      return;
    }

    try {
      if (item.target_type === 'collection' || (!item.post_id && item.collection_id)) {
        await postService.removeBookmark({ collectionId: item.collection_id });
      } else {
        await postService.removeBookmark({ postId: item.post_id });
      }

      setBookmarks((prev) => prev.filter((bookmark) => bookmark.bookmark_id !== item.bookmark_id));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove bookmark.');
    }
  };

  const handleOpenBookmark = (item) => {
    if (item.target_type === 'collection' || item.collection_id) {
      onOpenReference?.({
        reference_type: 'collection',
        reference_post_id: item.collection_id,
      });
      return;
    }

    onOpenReference?.({
      reference_type: item.post_type && item.post_type >= 20 ? 'article' : 'question',
      reference_post_id: item.post_id,
    });
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-black/0 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-[0.12em] text-slate-300 uppercase">BOOKMARKS</h3>
        <p className="text-xs text-slate-400">Saved posts and collections</p>
      </div>

      {error ? (
        <p className="mt-4 rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {loading ? <p className="mt-6 text-slate-300">Loading bookmarks...</p> : null}

      {!loading && bookmarks.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-10 text-center text-slate-400">
          No bookmarked posts yet.
        </div>
      ) : null}

      {!loading && bookmarks.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {bookmarks.map((item) => (
            <li key={item.bookmark_id} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-slate-100">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                    {item.post_type_label}
                  </span>
                  <span className="rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                    {item.views_count || 0} views
                  </span>
                  <span className="rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                    {item.vote_count || 0} votes
                  </span>
                  {item.delete_flag ? (
                    <span className="rounded-full border border-rose-300/30 bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-medium text-rose-200">
                      Deleted
                    </span>
                  ) : null}
                </div>

                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveBookmark(item)}
                    className="rounded-full border border-amber-300/70 bg-amber-400/20 px-3 py-1 text-xs font-medium text-amber-100 transition hover:bg-amber-400/30"
                  >
                    Remove
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => handleOpenBookmark(item)}
                className={`mt-2 text-left text-base font-semibold transition hover:underline ${
                  item.delete_flag
                    ? 'text-rose-300 hover:text-rose-200'
                    : 'text-slate-100 hover:text-cyan-200'
                }`}
              >
                {item.title}
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
                      onClick={() => onOpenUserProfile?.(item.user_id || item.user)}
                      className="font-medium text-slate-300 transition hover:text-cyan-200 hover:underline"
                    >
                      {item.user_name}
                    </button>{' '}
                    posted {formatBookmarkTime(item.created_at, formatProfileTime)}
                  </span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default BookmarksTab;
