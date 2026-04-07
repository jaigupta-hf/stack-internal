import CommentSection, {
  buildCommentKey,
  buildCommentItemKey,
} from '../CommentSection';
import VotePanel from '../VotePanel';

function ArticleDetailPanel({ controller, onOpenUserProfile }) {
  const {
    selectedArticle,
    typeLabelByCode,
    formatVerboseRelativeTime,
    isEditingArticle,
    editTitle,
    setEditTitle,
    editArticleType,
    setEditArticleType,
    ARTICLE_TYPE_OPTIONS,
    editBody,
    setEditBody,
    editTags,
    removeEditTag,
    editTagInput,
    setEditTagInput,
    setEditTagError,
    normalizeTagName,
    addEditTag,
    editTagSuggestions,
    searchingEditTags,
    editTagError,
    editError,
    handleSaveArticleEdit,
    savingEdit,
    handleCancelArticleEdit,
    handleArticleUpvote,
    handleToggleArticleBookmark,
    handleApplyArticleTagFilter,
    handleStartArticleEdit,
    formatArticleListTime,
    articleCommentData,
    collapsedCommentSections,
    commentDrafts,
    commentErrors,
    showDeletedTrees,
    activeCommentMenuKey,
    editingCommentKey,
    editingCommentBody,
    setEditingCommentBody,
    replyDrafts,
    activeReplyComposerKey,
    toggleCommentSection,
    handleCommentDraftChange,
    handleAddComment,
    setShowDeletedTrees,
    toggleCommentMenu,
    toggleReplyComposer,
    handleReplyDraftChange,
    handleSaveCommentEdit,
    handleStartCommentEdit,
    handleDeleteComment,
    handleCommentUpvote,
    handleAddReply,
    cancelCommentEdit,
    cancelReplyComposer,
    formatArticleTime,
    articleVoteError,
  } = controller;

  if (!selectedArticle) {
    return null;
  }

  return (
    <div className="mt-6 w-full rounded-3xl border border-white/10 bg-[#111821] p-6 shadow-2xl shadow-black/35 sm:p-8">
      <div className="mb-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-2xl font-semibold text-white">{selectedArticle.title}</h3>
        </div>

        <div className="mt-2 flex items-start gap-3">
          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1">
              Type: {selectedArticle.type_label || typeLabelByCode[selectedArticle.type] || 'Article'}
            </span>
            <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1">
              Published: {formatVerboseRelativeTime(selectedArticle.created_at)}
            </span>
            <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1">
              {selectedArticle.views_count || 0} views
            </span>
          </div>
        </div>
        <div className="mt-3 border-t border-white/15" />
      </div>

      {isEditingArticle ? (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-200">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-full border border-white/15 bg-black/20 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
              placeholder="Article title"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-200">Type</label>
            <select
              value={editArticleType}
              onChange={(e) => setEditArticleType(Number(e.target.value))}
              className="w-full rounded-full border border-white/15 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
            >
              {ARTICLE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#111821] text-slate-100">
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-200">Body</label>
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="min-h-[200px] w-full rounded-3xl border border-white/15 bg-black/20 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
              placeholder="Write article content..."
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-200">
              Tags <span className="text-slate-400">(max 5)</span>
            </label>

            <div className="mb-0.5 flex flex-wrap gap-2">
              {editTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-2 rounded-sm border border-cyan-300/0 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-400"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeEditTag(tag)}
                    className="text-cyan-200 transition hover:text-white"
                    aria-label={`Remove ${tag}`}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>

            <div className="relative">
              <input
                type="text"
                value={editTagInput}
                onChange={(e) => {
                  setEditTagError('');
                  setEditTagInput(normalizeTagName(e.target.value));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                    e.preventDefault();
                    addEditTag(editTagInput);
                  }
                }}
                className="w-full rounded-full border border-white/15 bg-black/25 px-4 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                placeholder="Type a tag and press Space"
              />

              {(editTagSuggestions.length > 0 || searchingEditTags) && editTagInput.trim() ? (
                <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-white/15 bg-[#0f141c] shadow-lg shadow-black/40">
                  {searchingEditTags ? (
                    <p className="px-3 py-2 text-xs text-slate-400">Searching tags...</p>
                  ) : (
                    <ul className="max-h-48 overflow-y-auto py-1">
                      {editTagSuggestions.map((tag) => (
                        <li key={tag.id}>
                          <button
                            type="button"
                            onClick={() => addEditTag(tag.name)}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10"
                          >
                            <span>{tag.name}</span>
                            <span className="text-xs text-slate-400">{(Number(tag.question_count || 0) + Number(tag.article_count || 0))} posts</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {editTagError ? (
            <p className="rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
              {editTagError}
            </p>
          ) : null}

          {editError ? (
            <p className="rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
              {editError}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveArticleEdit}
              disabled={savingEdit}
              className="rounded-full bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingEdit ? 'Saving...' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={handleCancelArticleEdit}
              className="rounded-full border border-white/0 bg-white/10 px-4 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/20"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <VotePanel
            score={selectedArticle.vote_count}
            currentVote={selectedArticle.current_user_vote}
            onUpvote={handleArticleUpvote}
            upvoteAriaLabel="Upvote article"
            showBookmark
            isBookmarked={Boolean(selectedArticle.is_bookmarked)}
            onToggleBookmark={() => handleToggleArticleBookmark(selectedArticle.id)}
            bookmarkAriaLabel="Bookmark article"
            showBookmarkCount
            bookmarkCount={selectedArticle.bookmarks_count}
          />

          <div className="min-w-0 flex-1">
            <div className="rounded-2xl border border-white/0 bg-white/5 px-3 py-2 text-sm text-slate-200 whitespace-pre-wrap">
              {selectedArticle.body}
              {selectedArticle.tags && selectedArticle.tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedArticle.tags.map((tag) => (
                    <button
                      type="button"
                      key={tag.id || tag.name}
                      onClick={() => handleApplyArticleTagFilter(tag.name || '')}
                      className="rounded-sm border border-cyan-300/0 bg-cyan-500/10 px-3 py-0.5 text-xs font-medium text-cyan-400"
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-3 flex items-start gap-3">
              {!isEditingArticle ? (
                <button
                  type="button"
                  onClick={handleStartArticleEdit}
                  className="text-xs font-medium text-white/50 transition hover:text-cyan-200"
                >
                  Edit
                </button>
              ) : null}
              <div className="ml-auto shrink-0 text-right text-xs text-slate-400">
                <div className="rounded-xl bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200">
                  <span className="block font-medium">published {formatArticleListTime(selectedArticle.created_at)}</span>
                  <button
                    type="button"
                    onClick={() => onOpenUserProfile?.(selectedArticle.user)}
                    className="block text-cyan-100 transition hover:text-white hover:underline"
                  >
                    {selectedArticle.user_name}
                  </button>
                </div>
              </div>
            </div>

            <CommentSection
              targetType="article"
              targetId={selectedArticle.id}
              commentsCount={(selectedArticle.comments || []).length}
              commentData={articleCommentData}
              collapsed={Boolean(collapsedCommentSections[buildCommentKey('article', selectedArticle.id)])}
              onToggleCollapsed={() => toggleCommentSection('article', selectedArticle.id)}
              draftValue={commentDrafts[buildCommentKey('article', selectedArticle.id)] || ''}
              onDraftChange={(value) => handleCommentDraftChange('article', selectedArticle.id, value)}
              onAddComment={() => handleAddComment('article', selectedArticle.id, selectedArticle.id)}
              errorMessage={commentErrors[buildCommentKey('article', selectedArticle.id)]}
              showDeletedTree={Boolean(showDeletedTrees[buildCommentKey('article', selectedArticle.id)])}
              onShowDeletedTree={() =>
                setShowDeletedTrees((prev) => ({
                  ...prev,
                  [buildCommentKey('article', selectedArticle.id)]: true,
                }))
              }
              activeCommentMenuKey={activeCommentMenuKey}
              editingCommentKey={editingCommentKey}
              editingCommentBody={editingCommentBody}
              onEditingCommentBodyChange={setEditingCommentBody}
              replyDrafts={replyDrafts}
              activeReplyComposerKey={activeReplyComposerKey}
              onToggleCommentMenu={toggleCommentMenu}
              onToggleReplyComposer={toggleReplyComposer}
              onReplyDraftChange={handleReplyDraftChange}
              onSaveCommentEdit={handleSaveCommentEdit}
              onStartCommentEdit={handleStartCommentEdit}
              onDeleteComment={handleDeleteComment}
              onCommentUpvote={handleCommentUpvote}
              onAddReply={handleAddReply}
              onCancelCommentEdit={cancelCommentEdit}
              onCancelReplyComposer={cancelReplyComposer}
              onOpenUserProfile={onOpenUserProfile}
              formatTime={formatArticleTime}
              getCommentKey={buildCommentKey}
              getCommentItemKey={buildCommentItemKey}
            />
          </div>
        </div>
      )}

      {articleVoteError ? (
        <p className="mt-3 rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
          {articleVoteError}
        </p>
      ) : null}
    </div>
  );
}

export default ArticleDetailPanel;
