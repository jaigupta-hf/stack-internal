export const EMPTY_COMMENT_DATA = {
  roots: [],
  repliesByParentId: {},
  orphanRepliesByMissingParent: {},
};

export const buildCommentKey = (targetType, targetId) => `${targetType}:${targetId}`;

export const buildCommentItemKey = (targetType, targetId, commentId) =>
  `${buildCommentKey(targetType, targetId)}:${commentId}`;

export const buildCommentData = (serverComments) => {
  const comments = Array.isArray(serverComments) ? serverComments : [];
  const commentById = new Map(comments.map((comment) => [comment.id, comment]));
  const repliesByParentId = {};
  const orphanRepliesByMissingParent = {};

  comments.forEach((comment) => {
    if (!comment.parent_comment) {
      return;
    }

    if (commentById.has(comment.parent_comment)) {
      const list = repliesByParentId[comment.parent_comment] || [];
      repliesByParentId[comment.parent_comment] = [...list, comment];
      return;
    }

    const orphanList = orphanRepliesByMissingParent[comment.parent_comment] || [];
    orphanRepliesByMissingParent[comment.parent_comment] = [...orphanList, comment];
  });

  return {
    roots: comments.filter((comment) => !comment.parent_comment),
    repliesByParentId,
    orphanRepliesByMissingParent,
  };
};

function CommentSection({
  targetType,
  targetId,
  commentsCount,
  commentData = EMPTY_COMMENT_DATA,
  collapsed,
  onToggleCollapsed,
  draftValue,
  onDraftChange,
  onAddComment,
  errorMessage,
  showDeletedTree,
  onShowDeletedTree,
  activeCommentMenuKey,
  editingCommentKey,
  editingCommentBody,
  onEditingCommentBodyChange,
  replyDrafts,
  activeReplyComposerKey,
  onToggleCommentMenu,
  onToggleReplyComposer,
  onReplyDraftChange,
  onSaveCommentEdit,
  onStartCommentEdit,
  onDeleteComment,
  onCommentUpvote,
  onAddReply,
  onCancelCommentEdit,
  onCancelReplyComposer,
  onOpenUserProfile,
  formatTime,
  getCommentItemKey,
  containerClassName = 'mt-3 max-w-xl',
}) {
  const commentItemKeyBuilder = getCommentItemKey || buildCommentItemKey;

  const renderCommentNode = (comment, depth, repliesByParentId) => {
    const itemKey = commentItemKeyBuilder(targetType, targetId, comment.id);
    const isEditing = editingCommentKey === itemKey;
    const isMenuOpen = activeCommentMenuKey === itemKey;
    const canReply = depth < 2;
    const replies = repliesByParentId[comment.id] || [];

    return (
      <li id={`comment-${comment.id}`} key={comment.id} className="relative border-l-2 border-cyan-300/40 pl-2">
        <div className="min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={editingCommentBody}
                onChange={(event) => onEditingCommentBodyChange(event.target.value)}
                maxLength={280}
                className="h-7 w-full rounded-full border border-white/15 bg-black/20 px-3 text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
              />
              <button
                type="button"
                onClick={() => onSaveCommentEdit(targetType, targetId, comment.id)}
                className="rounded-full bg-cyan-400 px-2.5 py-1 text-[10px] font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Save
              </button>
              <button
                type="button"
                onClick={onCancelCommentEdit}
                className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[10px] text-slate-300 transition hover:bg-white/15"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <p className="mt-1 text-[11px] text-slate-400">
                <button
                  type="button"
                  onClick={() => onOpenUserProfile?.(comment.user)}
                  className="font-medium text-slate-300 transition hover:text-cyan-200 hover:underline"
                >
                  {comment.user_name || comment.username || 'User'}
                </button>{' '}
                commented {formatTime(comment.created_at)}
              </p>
              <p className="text-xs leading-5 text-slate-200 whitespace-pre-wrap">{comment.body}</p>

              <div className="mt-1.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onCommentUpvote(targetType, targetId, comment.id)}
                  className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                    Number(comment.current_user_vote || 0) === 1
                      ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100 hover:bg-cyan-400/30'
                      : 'border-white/20 bg-white/5 text-slate-300 hover:bg-white/15'
                  }`}
                >
                  ^ {comment.vote_count || 0}
                </button>

                {canReply ? (
                  <button
                    type="button"
                    onClick={() => onToggleReplyComposer(itemKey)}
                    className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300 transition hover:bg-white/15"
                  >
                    Reply
                  </button>
                ) : null}

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => onToggleCommentMenu(targetType, targetId, comment.id)}
                    className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300 transition hover:bg-white/15"
                    aria-label="Comment actions"
                  >
                    ...
                  </button>
                  {isMenuOpen ? (
                    <div className="absolute left-0 z-10 mt-1 w-24 overflow-hidden rounded-lg border border-white/15 bg-[#0f141c]">
                      <button
                        type="button"
                        onClick={() => onStartCommentEdit(targetType, targetId, comment)}
                        className="block w-full px-2.5 py-1.5 text-left text-[11px] text-slate-200 transition hover:bg-white/10"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteComment(targetType, targetId, comment.id)}
                        className="block w-full px-2.5 py-1.5 text-left text-[11px] text-rose-200 transition hover:bg-white/10"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {canReply && activeReplyComposerKey === itemKey ? (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={replyDrafts[itemKey] || ''}
                    onChange={(event) => onReplyDraftChange(itemKey, event.target.value)}
                    maxLength={280}
                    className="h-7 w-full rounded-full border border-white/15 bg-black/20 px-3 text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                    placeholder="Reply to this comment"
                  />
                  <button
                    type="button"
                    onClick={() => onAddReply(targetType, targetId, itemKey, comment.id, depth)}
                    className="rounded-full bg-cyan-400 px-2.5 py-1 text-[10px] font-semibold text-slate-950 transition hover:bg-cyan-300"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={onCancelReplyComposer}
                    className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[10px] text-slate-300 transition hover:bg-white/15"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>

        {replies.length > 0 ? (
          <ul className="mt-2 ml-3 space-y-1.5">
            {replies.map((reply) => renderCommentNode(reply, depth + 1, repliesByParentId))}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <div className={containerClassName}>
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold tracking-[0.08em] text-slate-300 uppercase">
          Comments ({commentsCount || 0})
        </p>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-white/5 text-slate-300 transition hover:bg-white/15"
          aria-label="Toggle comments"
        >
          {collapsed ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3" aria-hidden="true">
              <path d="m6 10 6 6 6-6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3" aria-hidden="true">
              <path d="m6 14 6-6 6 6" />
            </svg>
          )}
        </button>
      </div>

      {!collapsed && commentData.roots.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {commentData.roots.map((comment) =>
            renderCommentNode(comment, 0, commentData.repliesByParentId)
          )}
        </ul>
      ) : null}

      <div className="mt-2.5 flex items-center gap-2">
        <input
          type="text"
          value={draftValue || ''}
          onChange={(event) => onDraftChange(event.target.value)}
          maxLength={280}
          className="h-8 w-full rounded-full border border-white/10 bg-black/20 px-3 text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
          placeholder="Add a short comment"
        />
        <button
          type="button"
          onClick={() => onAddComment(targetType, targetId)}
          className="rounded-full bg-cyan-500 px-3 py-1.5 text-[11px] font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          Add
        </button>
      </div>

      {errorMessage ? (
        <p className="mt-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-200">
          {errorMessage}
        </p>
      ) : null}

      {Object.keys(commentData.orphanRepliesByMissingParent).length > 0 && !showDeletedTree ? (
        <button
          type="button"
          onClick={onShowDeletedTree}
          className="mt-2 text-xs text-cyan-200 underline decoration-cyan-300/70 underline-offset-2 transition hover:text-cyan-100"
        >
          show more comments
        </button>
      ) : null}

      {showDeletedTree ? (
        <ul className="mt-2 space-y-1.5">
          {Object.entries(commentData.orphanRepliesByMissingParent).map(([missingParentId, replies]) => (
            <li key={`deleted-${targetType}-${targetId}-${missingParentId}`} className="border-l-2 border-white/20 pl-2">
              <p className="text-xs text-slate-500 italic">deleted</p>
              <ul className="mt-1 ml-3 space-y-1.5">
                {replies.map((reply) => renderCommentNode(reply, 1, commentData.repliesByParentId))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default CommentSection;
