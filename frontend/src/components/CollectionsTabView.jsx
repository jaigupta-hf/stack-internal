import QuestionTab from '../pages/navigationTabs/QuestionTab';
import ArticlesTab from '../pages/navigationTabs/ArticlesTab';
import CommentSection, {
  buildCommentKey,
  buildCommentItemKey,
} from './CommentSection';
import VotePanel from './VotePanel';

const COLLECTION_PAGE_SIZE_OPTIONS = [9, 18, 36];

const getVisiblePageNumbers = (pagination, windowSize = 5) => {
  const totalPages = Math.max(pagination?.total_pages || 1, 1);
  const currentPage = Math.min(Math.max(pagination?.page || 1, 1), totalPages);
  const halfWindow = Math.floor(windowSize / 2);

  let startPage = Math.max(currentPage - halfWindow, 1);
  let endPage = Math.min(startPage + windowSize - 1, totalPages);

  if (endPage - startPage + 1 < windowSize) {
    startPage = Math.max(endPage - windowSize + 1, 1);
  }

  const pages = [];
  for (let page = startPage; page <= endPage; page += 1) {
    pages.push(page);
  }

  return pages;
};

function CollectionsTabView({ team, isTeamAdmin, onOpenUserProfile, controller }) {
  const {
    collections,
    collectionsPageSize,
    collectionsPagination,
    loading,
    openingCollection,
    error,
    detailError,
    selectedCollection,
    showCreateModal,
    title,
    description,
    submitting,
    formError,
    postSearchTerm,
    postSearchResults,
    searchingPosts,
    searchError,
    addingPostId,
    collectionPostCards,
    selectedCollectionPost,
    openingCollectionPost,
    collectionPostError,
    collectionVoteError,
    collectionBookmarkError,
    votingCollection,
    commentDrafts,
    commentErrors,
    collapsedCommentSections,
    activeCommentMenuKey,
    editingCommentKey,
    editingCommentBody,
    replyDrafts,
    activeReplyComposerKey,
    showDeletedTrees,
    collectionCommentData,
    formatCollectionTime,
    getPostTypeLabel,
    isArticlePost,
    setShowCreateModal,
    setTitle,
    setDescription,
    setPostSearchTerm,
    setShowDeletedTrees,
    setEditingCommentBody,
    resetForm,
    handleCollectionsPrevPage,
    handleCollectionsNextPage,
    handleCollectionsGoToPage,
    handleCollectionPageSizeChange,
    handleBackToCollections,
    handleBackToCollectionPosts,
    handleCollectionUpvote,
    handleToggleCollectionBookmark,
    handleCommentDraftChange,
    handleAddComment,
    toggleCommentSection,
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
    handleAddPost,
    handleCreateCollection,
    openCollection,
    openCollectionPost,
  } = controller;

  return (
    /* Collection tab header */
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {selectedCollection ? (
            <button
              type="button"
              onClick={handleBackToCollections}
              className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/20"
            >
              Back
            </button>
          ) : null}

          <div>
            <h2 className="text-2xl font-semibold text-white">Collections</h2>
            {!selectedCollection ? (
              <p className="mt-2 text-slate-300">
                Curated lists of questions, answers, and articles for your team.
              </p>
            ) : null}
          </div>
        </div>

        {!selectedCollection && isTeamAdmin ? (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="rounded-full bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Create new collection
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {loading ? <p className="mt-6 text-slate-300">Loading collections...</p> : null}
      {!selectedCollection && openingCollection ? <p className="mt-6 text-slate-300">Opening collection...</p> : null}

      {selectedCollection ? (
        <div className="mt-6 w-full rounded-3xl border border-white/10 bg-[#111821] p-6 shadow-2xl shadow-black/35 sm:p-8">
          <div className="mb-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-2xl font-semibold text-white">{selectedCollection.title}</h3>
            </div>

            {/* Collection detail view */}
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1">
                Created: {formatCollectionTime(selectedCollection.created_at)}
              </span>
              <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1">
                {selectedCollection.views_count || 0} views
              </span>
              <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1">
                {selectedCollection.post_count || (selectedCollection.posts || []).length || 0} posts
              </span>
            </div>

            {/* Collection voting component */}
            {!selectedCollectionPost ? (
              <div className="mt-2 flex items-start gap-2">
                <VotePanel
                  score={selectedCollection.vote_count}
                  currentVote={selectedCollection.current_user_vote}
                  onUpvote={handleCollectionUpvote}
                  upvoteAriaLabel="Upvote collection"
                  upvoteDisabled={votingCollection}
                  disabledClassName="cursor-not-allowed opacity-70"
                  showBookmark
                  isBookmarked={Boolean(selectedCollection.is_bookmarked)}
                  onToggleBookmark={handleToggleCollectionBookmark}
                  bookmarkAriaLabel="Bookmark collection"
                  showBookmarkCount
                  bookmarkCount={selectedCollection.bookmarks_count}
                />

                <div className="min-w-0 flex-1">
                  {/* Collection description */}
                  <div className="rounded-2xl border border-white/0 bg-white/5 px-3 py-2">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">
                      {selectedCollection.description || 'No description provided.'}
                    </p>
                  </div>

                  <CommentSection
                    targetType="collection"
                    targetId={selectedCollection.id}
                    commentsCount={(selectedCollection.comments || []).length}
                    commentData={collectionCommentData}
                    collapsed={Boolean(collapsedCommentSections[buildCommentKey('collection', selectedCollection.id)])}
                    onToggleCollapsed={() => toggleCommentSection('collection', selectedCollection.id)}
                    draftValue={commentDrafts[buildCommentKey('collection', selectedCollection.id)] || ''}
                    onDraftChange={(value) => handleCommentDraftChange('collection', selectedCollection.id, value)}
                    onAddComment={() => handleAddComment('collection', selectedCollection.id)}
                    errorMessage={commentErrors[buildCommentKey('collection', selectedCollection.id)]}
                    showDeletedTree={Boolean(showDeletedTrees[buildCommentKey('collection', selectedCollection.id)])}
                    onShowDeletedTree={() =>
                      setShowDeletedTrees((prev) => ({
                        ...prev,
                        [buildCommentKey('collection', selectedCollection.id)]: true,
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
                    formatTime={formatCollectionTime}
                    getCommentKey={buildCommentKey}
                    getCommentItemKey={buildCommentItemKey}
                  />

                  {collectionVoteError ? (
                    <p className="mt-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-200">
                      {collectionVoteError}
                    </p>
                  ) : null}

                  {collectionBookmarkError ? (
                    <p className="mt-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-200">
                      {collectionBookmarkError}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{selectedCollection.description || 'No description provided.'}</p>
            )}
          </div>

          {!selectedCollectionPost ? (
            <>
              <div className="mt-3 border-t border-white/15" />

              <div className="mt-2">
                {isTeamAdmin ? (
                  <>
                    <h4 className="text-sm font-semibold tracking-[0.08em] text-slate-300 uppercase">Add posts</h4>

                    <input
                      type="text"
                      value={postSearchTerm}
                      onChange={(e) => setPostSearchTerm(e.target.value)}
                      className="mt-2 h-10 w-full rounded-full border border-white/10 bg-black/20 px-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                      placeholder="Search questions and articles by title"
                    />

                    {searchingPosts ? <p className="mt-2 text-xs text-slate-300">Searching posts...</p> : null}
                    {searchError ? (
                      <p className="mt-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-200">
                        {searchError}
                      </p>
                    ) : null}

                    {postSearchResults.length > 0 ? (
                      <ul className="mt-3 space-y-2">
                        {postSearchResults.map((post) => (
                          <li key={post.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-100">{post.title}</p>
                                <p className="mt-0.5 text-xs text-slate-400">{getPostTypeLabel(post)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddPost(post.id)}
                                disabled={post.already_added || addingPostId === post.id}
                                className="rounded-full bg-cyan-400 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {post.already_added ? 'Added' : addingPostId === post.id ? 'Adding...' : 'Add'}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : (
                  <p className="rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs text-slate-300">
                    Only admins can add posts to this collection.
                  </p>
                )}
              </div>

              {/* Collection posts list */}
              <div className="mt-5">
                <h4 className="text-sm font-semibold tracking-[0.08em] text-slate-300 uppercase">
                  Posts ({(selectedCollection.posts || []).length})
                </h4>

                {(selectedCollection.posts || []).length > 0 ? (
                  <ol className="mt-3 space-y-3">
                    {(selectedCollection.posts || []).map((postRef) => {
                      const card = collectionPostCards[Number(postRef.post_id)] || postRef;
                      const articleCard = isArticlePost(postRef);

                      if (articleCard) {
                        return (
                          <li key={`${postRef.post_id}-${postRef.sequence_number}`}>
                            <button
                              type="button"
                              onClick={() => openCollectionPost(postRef, true)}
                              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left transition"
                            >
                              <div className="flex items-center gap-2">
                                <span className="rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                                  {card.type_label || getPostTypeLabel(card)}
                                </span>
                                <span className="rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                                  {card.views_count || 0} views
                                </span>
                              </div>
                              <h3 className="mt-2 text-base font-semibold text-slate-100">{card.title}</h3>
                              <p
                                className="mt-1 text-sm text-slate-300"
                                style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {card.body || ''}
                              </p>

                              <div className="mt-2 flex items-center justify-between gap-3">
                                <div className="min-w-0 flex flex-wrap gap-2">
                                  {(card.tags || []).map((tag) => (
                                    <span
                                      key={tag.id || tag.name}
                                      className="rounded-sm border border-cyan-300/0 bg-cyan-300/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-400"
                                    >
                                      {tag.name}
                                    </span>
                                  ))}
                                </div>
                                <span className="shrink-0 text-xs text-slate-400">
                                  <button
                                    type="button"
                                    onClick={() => onOpenUserProfile?.(card.user_id || card.user)}
                                    className="font-medium text-slate-300 transition hover:text-cyan-200 hover:underline"
                                  >
                                    {card.user_name}
                                  </button>{' '}
                                  created {formatCollectionTime(card.created_at)}
                                </span>
                              </div>
                            </button>
                          </li>
                        );
                      }

                      return (
                        <li key={`${postRef.post_id}-${postRef.sequence_number}`}>
                          <button
                            type="button"
                            onClick={() => openCollectionPost(postRef, true)}
                            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left text-slate-100"
                          >
                            <div className="mb-2 flex items-center gap-2">
                              <span
                                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                                  card.approved_answer
                                    ? 'border-emerald-300/0 bg-emerald-400/20 text-emerald-300'
                                    : 'border-white/0 bg-white/10 text-slate-300'
                                }`}
                              >
                                {card.answer_count || 0} answers
                              </span>
                              <span className="rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                                {card.views_count || 0} views
                              </span>
                            </div>
                            <div className="flex items-start justify-between gap-4">
                              <p className="font-medium text-slate-100">{card.title}</p>
                            </div>
                            <div className="flex items-start justify-between gap-4">
                              <p
                                className="mt-1 text-sm text-slate-300"
                                style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {card.body || ''}
                              </p>
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-4">
                              <div className="min-w-0 flex flex-wrap gap-2">
                                {(card.tags || []).map((tag) => (
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
                                    onClick={() => onOpenUserProfile?.(card.user_id || card.user)}
                                    className="font-medium text-slate-300 transition hover:text-cyan-200 hover:underline"
                                  >
                                    {card.user_name}
                                  </button>{' '}
                                  asked {formatCollectionTime(card.created_at)}
                                </span>
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">No posts added yet.</p>
                )}
              </div>
            </>
          ) : (
            <div className="mt-2">
              <div className="mb-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBackToCollectionPosts}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/20"
                >
                  Back to posts
                </button>
                {openingCollectionPost ? <span className="text-xs text-slate-300">Opening post...</span> : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-2 py-2 sm:px-3 sm:py-3">
                {selectedCollectionPost.is_article ? (
                  <ArticlesTab
                    key={`collection-article-${selectedCollectionPost.post_id}`}
                    team={team}
                    embeddedMode
                    onOpenUserProfile={onOpenUserProfile}
                  />
                ) : (
                  <QuestionTab
                    key={`collection-question-${selectedCollectionPost.post_id}`}
                    team={team}
                    embeddedMode
                    onOpenUserProfile={onOpenUserProfile}
                  />
                )}
              </div>
            </div>
          )}

          {detailError ? (
            <p className="mt-3 rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
              {detailError}
            </p>
          ) : null}

          {collectionPostError ? (
            <p className="mt-3 rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
              {collectionPostError}
            </p>
          ) : null}
        </div>
      ) : null}

      {!loading && !selectedCollection && collections.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-10 text-center text-slate-400">
          No collections created yet.
        </div>
      ) : null}

      {!loading && !selectedCollection && collections.length > 0 ? (
        <>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {collections.map((collection) => (
              <li key={collection.id}>
                <div className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                        {collection.views_count || 0} views
                      </span>
                      <span className="shrink-0 rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                        {collection.post_count || 0} posts
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">{formatCollectionTime(collection.created_at)}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => openCollection(collection.id, true)}
                    className="mt-2 text-left text-base font-semibold text-slate-100 transition hover:text-cyan-200 hover:underline"
                  >
                    {collection.title}
                  </button>
                  <p className="mt-1 text-sm text-slate-300 whitespace-pre-wrap">{collection.description || 'No description provided.'}</p>
                </div>
              </li>
            ))}
          </ul>

          {collectionsPagination ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-xs text-slate-300">
                Page {collectionsPagination.page} of {Math.max(collectionsPagination.total_pages || 1, 1)}
                {' '}•{' '}Total {collectionsPagination.total_items ?? collections.length} collections
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <span>Per page</span>
                  <select
                    value={collectionsPageSize}
                    onChange={(e) => handleCollectionPageSizeChange(e.target.value)}
                    className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-xs text-slate-100 outline-none"
                  >
                    {COLLECTION_PAGE_SIZE_OPTIONS.map((option) => (
                      <option
                        key={`collection-page-size-${option}`}
                        value={option}
                        className="bg-[#111821] text-slate-100"
                      >
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={handleCollectionsPrevPage}
                  disabled={!collectionsPagination.has_previous}
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={handleCollectionsNextPage}
                  disabled={!collectionsPagination.has_next}
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Next
                </button>

                {getVisiblePageNumbers(collectionsPagination).map((page) => (
                  <button
                    key={`collection-page-${page}`}
                    type="button"
                    onClick={() => handleCollectionsGoToPage(page)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      page === collectionsPagination.page
                        ? 'border-cyan-300/0 bg-cyan-300/20 text-cyan-100'
                        : 'border-white/15 bg-white/10 text-slate-200 hover:bg-white/20'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-[#111821] p-6 shadow-2xl shadow-black/50 sm:p-8">
            <h3 className="text-2xl font-semibold text-white">Create new collection</h3>

            <form onSubmit={handleCreateCollection} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-full border border-white/15 bg-black/20 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                  placeholder="Collection title"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[160px] w-full rounded-3xl border border-white/15 bg-black/20 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                  placeholder="Describe this collection"
                />
              </div>

              {formError ? (
                <p className="rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
                  {formError}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/20"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Creating...' : 'Create collection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CollectionsTabView;
