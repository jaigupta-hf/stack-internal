import { useEffect, useMemo, useState } from 'react';
import { notificationService } from '../../services/api';

const formatFeedTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) {
    return `${Math.max(1, minutes)}m ago`;
  }

  const hours = Math.floor(diffMs / 3600000);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(diffMs / 86400000);
  if (days < 30) {
    return `${days}d ago`;
  }

  return date.toLocaleString();
};

const reasonToActionText = (item) => {
  if (item.reason === 'answer_posted_on_your_question') {
    return 'answered your question';
  }

  if (item.reason === 'question_edited') {
    return 'edited your question';
  }

  if (item.reason === 'question_deleted') {
    return 'deleted your question';
  }

  if (item.reason === 'question_closed') {
    return 'closed your question';
  }

  if (item.reason === 'question_commented') {
    return 'commented on your question';
  }

  if (item.reason === 'your_answer_was_approved') {
    return 'approved your answer';
  }

  if (item.reason === 'answer_edited') {
    return 'edited your answer';
  }

  if (item.reason === 'answer_commented') {
    return 'commented on your answer';
  }

  if (item.reason === 'comment_replied') {
    return 'replied to your comment';
  }

  if (item.reason === 'mentioned_in_question') {
    return 'mentioned you in a question';
  }

  if (item.reason === 'new_answer_on_followed_post') {
    return 'posted a new answer on a question you follow';
  }

  if (item.reason === 'new_comment_on_followed_post') {
    return 'commented on a question you follow';
  }

  if (item.reason === 'approved_answer_on_followed_post') {
    return 'approved an answer on a question you follow';
  }

  return 'interacted with your post';
};

function ForYouTab({ team, onOpenReference, onOpenUserProfile, onUnreadCountChange }) {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);

  const loadNotifications = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await notificationService.list(team.id);
      setItems(data.items || []);
      const nextUnreadCount = Number(data.unread_count || 0);
      setUnreadCount(nextUnreadCount);
      onUnreadCountChange?.(nextUnreadCount);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load your feed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [team.id]);

  const unreadIds = useMemo(() => items.filter((item) => !item.is_read).map((item) => item.id), [items]);

  const handleMarkRead = async (notificationId) => {
    try {
      await notificationService.markRead(notificationId);
      setItems((prev) => prev.map((item) => (item.id === notificationId ? { ...item, is_read: true } : item)));
      setUnreadCount((prev) => {
        const next = Math.max(prev - 1, 0);
        onUnreadCountChange?.(next);
        return next;
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to mark notification as read.');
    }
  };

  const handleMarkUnread = async (notificationId) => {
    try {
      await notificationService.markUnread(notificationId);
      setItems((prev) => prev.map((item) => (item.id === notificationId ? { ...item, is_read: false } : item)));
      setUnreadCount((prev) => {
        const next = prev + 1;
        onUnreadCountChange?.(next);
        return next;
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to mark notification as unread.');
    }
  };

  const handleMarkAllRead = async () => {
    if (!unreadIds.length) {
      return;
    }

    try {
      setMarkingAllRead(true);
      await notificationService.markAllRead(team.id);
      setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
      onUnreadCountChange?.(0);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to mark all notifications as read.');
    } finally {
      setMarkingAllRead(false);
    }
  };

  const visibleItems = useMemo(
    () => (showOnlyUnread ? items.filter((item) => !item.is_read) : items),
    [items, showOnlyUnread],
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-white">For You</h2>
          <p className="text-sm text-slate-300">Recent interactions related to your posts and answers.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowOnlyUnread((prev) => !prev)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              showOnlyUnread
                ? 'border-cyan-300/0 bg-cyan-300/20 text-cyan-100'
                : 'border-white/0 bg-white/10 text-slate-200 hover:bg-white/20'
            }`}
          >
            {showOnlyUnread ? 'Showing unread only' : 'Show unread only'}
          </button>
          <span className="rounded-full border border-cyan-300/0 bg-cyan-300/15 px-3 py-1 text-xs font-medium text-cyan-200">
            {unreadCount} unread
          </span>
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markingAllRead || unreadCount === 0}
            className="rounded-full border border-white/0 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {markingAllRead ? 'Marking...' : 'Mark all read'}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">{error}</p>
      ) : null}

      {loading ? <p className="mt-6 text-slate-300">Loading your feed...</p> : null}

      {!loading && visibleItems.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-10 text-center text-slate-400">
          {showOnlyUnread ? 'No unread notifications.' : 'No notifications yet.'}
        </div>
      ) : null}

      {!loading && visibleItems.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {visibleItems.map((item) => {
            const isDeletedPost = Boolean(item.post_delete_flag);
            const postTypeLabel = item.post_type === 1 ? 'Answer' : item.post_type === 0 ? 'Question' : 'Post';

            return (
              <li
                key={item.id}
                className={`rounded-2xl border px-4 py-3 ${
                  item.is_read
                    ? 'border-white/10 bg-black/20'
                    : 'border-cyan-300/20 bg-cyan-400/10'
                }`}
              >
                <div className="mb-2 flex flex-wrap justify-between items-center gap-2">
                  <span className="rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                    {postTypeLabel}
                  </span>
                  {!item.is_read ? (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(item.id)}
                      className="rounded-full border border-amber-300/30 bg-amber-400/20 px-3 py-0.5 text-[11px] font-medium text-amber-100 transition hover:bg-amber-400/30"
                    >
                      Mark as read
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleMarkUnread(item.id)}
                      className="rounded-full border border-amber-300/30 bg-amber-400/20 px-3 py-0.5 text-[11px] font-medium text-amber-100 transition hover:bg-amber-400/30"
                    >
                      Mark as unread
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={`text-sm font-medium ${isDeletedPost ? 'text-rose-300' : 'text-slate-100'}`}>
                    <button
                      type="button"
                      onClick={() => onOpenUserProfile?.(item.triggered_by_id)}
                      className="font-semibold text-cyan-200 transition hover:text-cyan-100 hover:underline"
                    >
                      {item.triggered_by_name}
                    </button>{' '}
                    {reasonToActionText(item)}
                  </p>
                  <span className="text-xs text-slate-400">{formatFeedTime(item.created_at)}</span>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenReference?.(item)}
                  className={`mt-1 text-left text-sm transition hover:underline ${
                    isDeletedPost
                      ? 'text-rose-300/80 hover:text-rose-200'
                      : 'text-slate-300 hover:text-cyan-200'
                  }`}
                >
                  {item.post_title || 'Untitled post'}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default ForYouTab;
