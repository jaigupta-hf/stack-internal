import { useEffect, useState } from 'react';
import { postService } from '../../services/api';
import AsyncStateView from '../../components/AsyncStateView';
import { formatBookmarkTime } from '../../utils/dateTime';

function BookmarksTab({ team, onOpenReference, onOpenUserProfile }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadBookmarks = async () => {
      if (!team?.id) {
        setBookmarks([]);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const data = await postService.listBookmarks(team.id);
        setBookmarks(data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load bookmarks.');
      } finally {
        setLoading(false);
      }
    };

    loadBookmarks();
  }, [team?.id]);

  const handleRemoveBookmark = async (item) => {
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

  return (
    <div>
      <h2 className="text-2xl font-semibold text-white">Bookmarks</h2>
      <p className="mt-2 text-slate-300">Your saved posts for this team.</p>

      <AsyncStateView
        loading={loading}
        error={error}
        isEmpty={bookmarks.length === 0}
        loadingMessage="Loading bookmarks..."
        emptyMessage="No bookmarked posts yet."
        loadingClassName="mt-6 text-slate-300"
        errorClassName="mt-4 rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200"
        emptyClassName="mt-6 rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-10 text-center text-slate-400"
      >
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
                    <span className="rounded-full border border-rose-300/0 bg-rose-400/20 px-2.5 py-0.5 text-[11px] font-medium text-rose-200">
                      Deleted
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveBookmark(item)}
                  className="rounded-full border border-amber-300/30 bg-amber-400/20 px-3 py-1 text-xs font-medium text-amber-100 transition hover:bg-amber-400/30"
                >
                  Remove
                </button>
              </div>

              <button
                type="button"
                onClick={() => onOpenReference?.(item)}
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
                      className="rounded-sm border border-cyan-300/0 bg-cyan-300/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-400"
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
                    posted {formatBookmarkTime(item.created_at)}
                  </span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </AsyncStateView>
    </div>
  );
}

export default BookmarksTab;
