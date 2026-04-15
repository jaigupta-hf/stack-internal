import CommentSection, {
  buildCommentData,
  buildCommentKey,
  buildCommentItemKey,
} from '../CommentSection';
import VotePanel from '../VotePanel';
import { useAuth } from '../../context/AuthContext';

function QuestionDetailPanel({ controller, onOpenUserProfile }) {
  const { user } = useAuth();
  const {
    selectedQuestion,
    formatVerboseRelativeTime,
    isEditingQuestion,
    isEditingTagsOnly,
    editQuestionTitle,
    setEditQuestionTitle,
    editQuestionBody,
    setEditQuestionBody,
    editQuestionTags,
    removeEditTag,
    editTagInput,
    setEditTagInput,
    setEditTagError,
    sanitizeTagName,
    addEditTag,
    editTagSuggestions,
    searchingEditTags,
    editTagError,
    editQuestionError,
    handleSaveQuestionEdit,
    savingQuestionEdit,
    setIsEditingQuestion,
    setIsEditingTagsOnly,
    setEditQuestionError,
    getCloseReasonLabel,
    handleOpenQuestion,
    formatQuestionTime,
    handleQuestionVote,
    handleToggleQuestionBookmark,
    handleOpenQuestionHistoryPage,
    handleApplyTagFilter,
    handleStartTagsEdit,
    mentionSearchOpen,
    handleToggleMentionSearch,
    mentionQuery,
    setMentionQuery,
    mentionLoading,
    mentionCandidates,
    mentioningUserId,
    handleMentionUser,
    mentionError,
    removingMentionUserId,
    handleRemoveMentionUser,
    followingQuestion,
    handleToggleFollowQuestion,
    handleStartQuestionEdit,
    handleReopenQuestion,
    handleOpenCloseModal,
    handleUndeleteQuestion,
    deletingQuestion,
    handleDeleteQuestion,
    BOUNTY_REASONS,
    setSelectedBountyReason,
    setShowBountyModal,
    isActuallyEdited,
    questionCommentData,
    collapsedCommentSections,
    toggleCommentSection,
    commentDrafts,
    handleCommentDraftChange,
    handleAddComment,
    commentErrors,
    showDeletedTrees,
    setShowDeletedTrees,
    activeCommentMenuKey,
    editingCommentKey,
    editingCommentBody,
    setEditingCommentBody,
    replyDrafts,
    activeReplyComposerKey,
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
    voteError,
    approvalError,
    sortedAnswers,
    handleAnswerVote,
    handleApproveAnswer,
    awardingBountyAnswerId,
    handleAwardBounty,
    editingAnswerId,
    editAnswerBody,
    setEditAnswerBody,
    editAnswerError,
    handleSaveAnswerEdit,
    savingAnswerEdit,
    setEditingAnswerId,
    setEditAnswerError,
    handleStartAnswerEdit,
    handleUndeleteAnswer,
    deletingAnswerId,
    handleDeleteAnswer,
    handleAnswerSubmit,
    showAnswerSection,
    answerBody,
    setAnswerBody,
    answerError,
    submittingAnswer,
    setShowAnswerSection,
    setAnswerError,
  } = controller;

  if (!selectedQuestion) {
    return null;
  }

  const currentUserId = Number(user?.id || 0);
  const isQuestionAuthor = Number(selectedQuestion.user || 0) === currentUserId;

  return (
    <div className="mt-6 w-full rounded-3xl border border-white/10 bg-[#111821] p-6 shadow-2xl shadow-black/35 sm:p-8">
      <div className="mb-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-2xl font-semibold text-white">{selectedQuestion.title}</h3>
        </div>

        <div className="mt-2 flex items-start gap-3">
          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1">
              Asked: {formatVerboseRelativeTime(selectedQuestion.created_at)}
            </span>
            <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1">
              Modified: {formatVerboseRelativeTime(selectedQuestion.modified_at)}
            </span>
            <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1">
              {selectedQuestion.views_count || 0} views
            </span>
          </div>
        </div>
        <div className="mt-3 border-t border-white/15" />
      </div>

      {isEditingQuestion ? (
        <div className="space-y-2">
          {!isEditingTagsOnly ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">Title</label>
                <input
                  type="text"
                  value={editQuestionTitle}
                  onChange={(e) => setEditQuestionTitle(e.target.value)}
                  className="w-full rounded-full border border-white/15 bg-black/20 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">Body</label>
                <textarea
                  value={editQuestionBody}
                  onChange={(e) => setEditQuestionBody(e.target.value)}
                  className="min-h-[180px] w-full rounded-3xl border border-white/15 bg-black/20 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                  required
                />
              </div>
            </>
          ) : null}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-200">
              Tags <span className="text-slate-400">(max 5)</span>
            </label>

            <div className="rounded-2xl border border-white/15 bg-black/20 px-3 py-2">
              <div className="mb-2 flex flex-wrap gap-2">
                {editQuestionTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-2 rounded-sm border border-cyan-300/0 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-400"
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
                    setEditTagInput(sanitizeTagName(e.target.value));
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
          </div>

          {editTagError ? (
            <p className="rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
              {editTagError}
            </p>
          ) : null}

          {editQuestionError ? (
            <p className="rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
              {editQuestionError}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveQuestionEdit}
              disabled={savingQuestionEdit}
              className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingQuestionEdit ? 'Saving...' : isEditingTagsOnly ? 'Save tags' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditingQuestion(false);
                setIsEditingTagsOnly(false);
                setEditQuestionError('');
              }}
              className="rounded-full border border-white/0 bg-white/10 px-4 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/20"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {selectedQuestion.closed_reason ? (
            <div className="mb-3 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              <p className="font-medium">This question is closed as {getCloseReasonLabel(selectedQuestion.closed_reason)} and is not accepting new answers.</p>
              {selectedQuestion.closed_reason === 'duplicate' && selectedQuestion.duplicate_post_id ? (
                <p className="mt-1 text-xs text-rose-200">
                  Duplicate of question{': '}
                  <button
                    type="button"
                    onClick={() => handleOpenQuestion(selectedQuestion.duplicate_post_id)}
                    className="text-rose-100 underline decoration-rose-300/70 underline-offset-2 transition hover:text-white"
                  >{selectedQuestion.duplicate_post_title ? `${selectedQuestion.duplicate_post_title}` : ''}
                  </button>
                </p>
              ) : null}
              <p className="mt-1 text-xs text-rose-200">
                Closed {selectedQuestion.closed_at ? formatQuestionTime(selectedQuestion.closed_at) : 'recently'}
                {selectedQuestion.closed_by_username ? (
                  <>
                    {' '}by{' '}
                    <button
                      type="button"
                      onClick={() => onOpenUserProfile?.(selectedQuestion.closed_by)}
                      className="font-medium text-rose-100 underline decoration-rose-300/70 underline-offset-2 transition hover:text-white"
                    >
                      {selectedQuestion.closed_by_username}
                    </button>
                  </>
                ) : null}
              </p>
            </div>
          ) : null}

          {selectedQuestion.delete_flag ? (
            <div className="mb-3 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              <p className="font-medium">This question is deleted.</p>
            </div>
          ) : null}

          {(selectedQuestion.bounty_amount || 0) > 0 && selectedQuestion.bounty?.status === 'offered' ? (
            <div className="mb-3 rounded-2xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <p className="font-medium">This question has +{selectedQuestion.bounty_amount} bounty.</p>
              <p className="mt-1 text-xs text-amber-200">Reason: {selectedQuestion.bounty?.reason || '-'}</p>
            </div>
          ) : null}

          <div className="flex items-start gap-2">
            <VotePanel
              score={selectedQuestion.vote_count}
              currentVote={selectedQuestion.current_user_vote}
              onUpvote={() => handleQuestionVote(1)}
              onDownvote={() => handleQuestionVote(-1)}
              upvoteAriaLabel="Upvote question"
              downvoteAriaLabel="Downvote question"
              showBookmark
              isBookmarked={Boolean(selectedQuestion.is_bookmarked)}
              onToggleBookmark={() => handleToggleQuestionBookmark(selectedQuestion.id)}
              bookmarkAriaLabel="Bookmark question"
              showHistory
              onToggleHistory={handleOpenQuestionHistoryPage}
              historyAriaLabel="Show post history"
              showBookmarkCount
              bookmarkCount={selectedQuestion.bookmarks_count}
            />

            <div className="min-w-0 flex-1">
              <div className="rounded-2xl border border-white/0 bg-white/5 px-3 py-2 text-sm text-slate-200">
                <div className="max-h-[45vh] overflow-y-auto whitespace-pre-wrap">{selectedQuestion.body}</div>
                <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {(selectedQuestion.tags || []).map((tag) => (
                      <button
                        type="button"
                        key={tag.id || tag.name}
                        onClick={() => handleApplyTagFilter(tag.name || '')}
                        className="rounded-sm border border-cyan-300/0 bg-cyan-300/10 px-3 py-0.5 text-xs font-medium text-cyan-400"
                      >
                        {tag.name}
                      </button>
                    ))}

                    {isQuestionAuthor ? (
                      <button
                        type="button"
                        onClick={handleStartTagsEdit}
                        className="text-xs font-medium text-white/50 transition hover:text-cyan-200"
                      >
                        Edit tags
                      </button>
                    ) : null}
                  </div>

                  <div className="relative z-20 ml-auto">
                    <button
                      type="button"
                      onClick={handleToggleMentionSearch}
                      className="rounded-full border border-white/0 bg-white/10 px-3 py-1 text-xs font-medium text-slate-100 transition hover:bg-white/20"
                    >
                      Ask people
                    </button>

                    {mentionSearchOpen ? (
                      <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-white/15 bg-[#0f141c] p-3 shadow-2xl shadow-black/50">
                        <input
                          type="text"
                          value={mentionQuery}
                          onChange={(event) => setMentionQuery(event.target.value)}
                          className="w-full rounded-full border border-white/15 bg-black/20 px-3 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                          placeholder="Search users by name or email"
                        />

                        {mentionLoading ? <p className="mt-2 text-xs text-slate-400">Loading users...</p> : null}

                        {!mentionLoading && !mentionQuery.trim() ? (
                          <p className="mt-2 text-xs text-slate-400">Type to search people.</p>
                        ) : null}

                        {!mentionLoading && mentionQuery.trim() && mentionCandidates.length === 0 ? (
                          <p className="mt-2 text-xs text-slate-400">No users to mention.</p>
                        ) : null}

                        {!mentionLoading && mentionQuery.trim() && mentionCandidates.length > 0 ? (
                          <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                            {mentionCandidates.map((member) => (
                              <li key={member.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => onOpenUserProfile?.(member.id)}
                                    className="block truncate text-left text-xs font-medium text-slate-100 transition hover:text-cyan-200 hover:underline"
                                  >
                                    {member.name}
                                  </button>
                                  <p className="truncate text-[10px] text-slate-400">{member.email}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleMentionUser(member.id)}
                                  disabled={mentioningUserId === member.id}
                                  className="rounded-full border border-cyan-300/40 bg-cyan-400/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-100 transition hover:bg-cyan-400/30 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {mentioningUserId === member.id ? 'Adding...' : 'Mention'}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                {(selectedQuestion.mentions || []).length > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    <span className="text-slate-400">Asked to:</span>
                    {(selectedQuestion.mentions || []).map((mention) => (
                      <span
                        key={mention.id || mention.user_id}
                        className="inline-flex items-center gap-1 rounded-full border border-cyan-300/0 bg-cyan-400/10 px-2 py-0.5 font-medium text-cyan-100"
                      >
                        <button
                          type="button"
                          onClick={() => onOpenUserProfile?.(mention.user_id)}
                          className="transition hover:underline"
                        >
                          {mention.user_name}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveMentionUser(mention.user_id)}
                          disabled={removingMentionUserId === mention.user_id}
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-cyan-200/0 bg-cyan-400/10 text-[10px] text-cyan-100 transition hover:bg-cyan-300/35 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`Remove mention for ${mention.user_name}`}
                        >
                          {removingMentionUserId === mention.user_id ? '...' : 'x'}
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}

                {mentionError ? (
                  <p className="mt-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-200">
                    {mentionError}
                  </p>
                ) : null}
              </div>

              <div className="mt-3 flex items-start gap-3">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={handleToggleFollowQuestion}
                    disabled={followingQuestion}
                    className="text-xs font-medium text-white/50 transition hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {followingQuestion
                      ? (selectedQuestion.is_following ? 'Unfollowing...' : 'Following...')
                      : (selectedQuestion.is_following ? 'Unfollow' : 'Follow')}
                  </button>
                  {isQuestionAuthor ? (
                    <button
                      type="button"
                      onClick={handleStartQuestionEdit}
                      className="text-xs font-medium text-white/50 transition hover:text-cyan-200"
                    >
                      Edit
                    </button>
                  ) : null}
                  {selectedQuestion.closed_reason ? (
                    <button
                      type="button"
                      onClick={handleReopenQuestion}
                      className="text-xs font-medium text-white/50 transition hover:text-cyan-200"
                    >
                      Reopen
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenCloseModal}
                      className="text-xs font-medium text-white/50 transition hover:text-cyan-200"
                    >
                      Close
                    </button>
                  )}
                  {isQuestionAuthor ? (
                    selectedQuestion.delete_flag ? (
                      <button
                        type="button"
                        onClick={handleUndeleteQuestion}
                        disabled={deletingQuestion}
                        className="text-xs font-medium text-emerald-200 transition hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingQuestion ? 'Undeleting...' : 'Undelete'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleDeleteQuestion}
                        disabled={deletingQuestion}
                        className="text-xs font-medium text-white/50 transition hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingQuestion ? 'Deleting...' : 'Delete'}
                      </button>
                    )
                  ) : null}
                  {selectedQuestion.can_offer_bounty ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBountyReason(BOUNTY_REASONS[0].title);
                        setShowBountyModal(true);
                      }}
                      className="text-xs font-medium text-white/50 transition hover:text-cyan-200"
                    >
                      Offer bounty
                    </button>
                  ) : null}
                </div>

                <div className="ml-auto shrink-0 text-right text-xs text-slate-400">
                  <div className="flex items-start justify-end gap-4">
                    {isActuallyEdited(selectedQuestion.created_at, selectedQuestion.modified_at) ? (
                      <div>
                        <p>edited {formatQuestionTime(selectedQuestion.modified_at)}</p>
                      </div>
                    ) : null}
                    <div className="rounded-xl bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200">
                      <span className="block font-medium">asked {formatQuestionTime(selectedQuestion.created_at)}</span>
                      <button
                        type="button"
                        onClick={() => onOpenUserProfile?.(selectedQuestion.user)}
                        className="block text-cyan-100 transition hover:text-white hover:underline"
                      >
                        {selectedQuestion.user_name}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <CommentSection
                targetType="question"
                targetId={selectedQuestion.id}
                commentsCount={(selectedQuestion.comments || []).length}
                commentData={questionCommentData}
                collapsed={Boolean(collapsedCommentSections[buildCommentKey('question', selectedQuestion.id)])}
                onToggleCollapsed={() => toggleCommentSection('question', selectedQuestion.id)}
                draftValue={commentDrafts[buildCommentKey('question', selectedQuestion.id)] || ''}
                onDraftChange={(value) => handleCommentDraftChange('question', selectedQuestion.id, value)}
                onAddComment={() => handleAddComment('question', selectedQuestion.id, selectedQuestion.id)}
                errorMessage={commentErrors[buildCommentKey('question', selectedQuestion.id)]}
                showDeletedTree={Boolean(showDeletedTrees[buildCommentKey('question', selectedQuestion.id)])}
                onShowDeletedTree={() =>
                  setShowDeletedTrees((prev) => ({
                    ...prev,
                    [buildCommentKey('question', selectedQuestion.id)]: true,
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
                formatTime={formatQuestionTime}
                getCommentKey={buildCommentKey}
                getCommentItemKey={buildCommentItemKey}
              />
            </div>
          </div>

          <div className="mt-3 border-t border-white/15" />

          {voteError ? (
            <p className="mt-3 rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
              {voteError}
            </p>
          ) : null}

          {approvalError ? (
            <p className="mt-3 rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
              {approvalError}
            </p>
          ) : null}

          <div className="mt-4">
            <h4 className="text-sm font-semibold tracking-[0.08em] text-slate-300 uppercase">
              Answers ({selectedQuestion.answers ? selectedQuestion.answers.length : 0})
            </h4>
            {sortedAnswers.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {sortedAnswers.map((answer) => {
                  const edited = isActuallyEdited(answer.created_at, answer.modified_at);
                  const answerCommentData = buildCommentData(answer.comments);
                  const isAnswerAuthor = Number(answer.user || 0) === currentUserId;
                  const isAnswerDeleted = Boolean(answer.delete_flag);
                  const disableAnswerVoting = Boolean(selectedQuestion.delete_flag || isAnswerDeleted);
                  const disableApprove = Boolean(!selectedQuestion.can_approve_answers || selectedQuestion.delete_flag || isAnswerDeleted);
                  const isBountyAwardedAnswer = selectedQuestion.bounty?.status === 'earned'
                    && selectedQuestion.bounty?.awarded_answer === answer.id;

                  return (
                    <li key={answer.id} className="rounded-2xl py-3">
                      <div className="flex items-start gap-2">
                        <div className="flex shrink-0 flex-col items-center gap-1">
                          <VotePanel
                            score={answer.vote_count}
                            currentVote={answer.current_user_vote}
                            onUpvote={() => handleAnswerVote(answer.id, 1)}
                            onDownvote={() => handleAnswerVote(answer.id, -1)}
                            upvoteAriaLabel="Upvote answer"
                            downvoteAriaLabel="Downvote answer"
                            upvoteDisabled={disableAnswerVoting}
                            downvoteDisabled={disableAnswerVoting}
                            disabledClassName="cursor-not-allowed opacity-60 hover:bg-white/10"
                            className="flex flex-col items-center gap-1 rounded-xl border border-white/0 bg-black/30 px-2 py-2"
                          />

                          <button
                            type="button"
                            onClick={() => handleApproveAnswer(answer.id)}
                            disabled={disableApprove}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition ${
                              selectedQuestion.approved_answer === answer.id
                                ? 'border-emerald-300/70 bg-emerald-300/20 text-emerald-100 hover:bg-emerald-400/30'
                                : 'border-white/10 bg-white/10 text-slate-400 hover:bg-white/15'
                            } ${
                              disableApprove
                                ? 'cursor-not-allowed opacity-70 hover:bg-white/10'
                                : ''
                            }`}
                            aria-label="Approve answer"
                            title={
                              selectedQuestion.delete_flag
                                ? 'Cannot approve answers on a deleted question'
                                : isAnswerDeleted
                                  ? 'Cannot approve a deleted answer'
                                  : selectedQuestion.can_approve_answers
                                    ? 'Mark as accepted answer'
                                    : 'Only the question author can approve an answer'
                            }
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
                              <path d="m5 12 5 5L20 7" />
                            </svg>
                          </button>

                          {isBountyAwardedAnswer ? (
                            <div
                              className="inline-flex items-center justify-center rounded-full border border-amber-300/30 bg-amber-500/20 px-2 py-1 text-[10px] font-semibold text-amber-100"
                              title="This answer received the bounty"
                            >
                              +{selectedQuestion.bounty?.amount || 50}
                            </div>
                          ) : null}

                          {(selectedQuestion.bounty_amount || 0) > 0 && selectedQuestion.can_award_bounty ? (
                            <button
                              type="button"
                              onClick={() => handleAwardBounty(answer.id)}
                              disabled={isAnswerDeleted || awardingBountyAnswerId === answer.id}
                              className={`rounded-full border px-2 py-1 text-[10px] font-semibold transition ${
                                isAnswerDeleted
                                  ? 'cursor-not-allowed border-white/10 bg-white/10 text-slate-400 opacity-60'
                                  : 'border-amber-300/30 bg-amber-500/20 text-amber-100 hover:bg-amber-400/30'
                              } ${awardingBountyAnswerId === answer.id ? 'opacity-70' : ''}`}
                              title="Offer bounty to this answer"
                            >
                              {awardingBountyAnswerId === answer.id ? 'Giving...' : `+${selectedQuestion.bounty_amount}`}
                            </button>
                          ) : null}
                        </div>

                        <div className="min-w-0 flex-1">
                          {editingAnswerId === answer.id ? (
                            <div className="space-y-3">
                              <textarea
                                value={editAnswerBody}
                                onChange={(e) => setEditAnswerBody(e.target.value)}
                                className="min-h-[180px] w-full rounded-3xl border border-white/0 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                                required
                              />

                              {editAnswerError ? (
                                <p className="rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
                                  {editAnswerError}
                                </p>
                              ) : null}

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={handleSaveAnswerEdit}
                                  disabled={savingAnswerEdit}
                                  className="rounded-full bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {savingAnswerEdit ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingAnswerId(null);
                                    setEditAnswerBody('');
                                    setEditAnswerError('');
                                  }}
                                  className="rounded-full border border-white/0 bg-white/10 px-4 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/20"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p
                                className={`overflow-y-auto rounded-2xl border border-white/0 px-3 py-2 text-sm whitespace-pre-wrap ${
                                  isAnswerDeleted
                                    ? 'bg-rose-500/10 text-rose-200'
                                    : 'bg-white/5 text-slate-200'
                                }`}
                              >
                                {answer.body}
                              </p>

                              <div className="mt-3 flex items-start gap-3">
                                <div className="flex flex-col items-start gap-2">
                                  {isAnswerAuthor ? (
                                    <div className="mt-3 flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleStartAnswerEdit(answer)}
                                        disabled={isAnswerDeleted}
                                        className="text-xs font-medium text-white/50 transition hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Edit
                                      </button>
                                      {isAnswerDeleted ? (
                                        <button
                                          type="button"
                                          onClick={() => handleUndeleteAnswer(answer.id)}
                                          disabled={deletingAnswerId === answer.id}
                                          className="text-xs font-medium text-emerald-200 transition hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          {deletingAnswerId === answer.id ? 'Undeleting...' : 'Undelete'}
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteAnswer(answer.id)}
                                          disabled={deletingAnswerId === answer.id}
                                          className="text-xs font-medium text-white/50 transition hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          {deletingAnswerId === answer.id ? 'Deleting...' : 'Delete'}
                                        </button>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="ml-auto text-right text-sm text-slate-300">
                                  <div className="shrink-0 text-right text-xs text-slate-400">
                                    <div className="flex items-start justify-end gap-4">
                                      {edited ? (
                                        <div>
                                          <p>edited {formatQuestionTime(answer.modified_at)}</p>
                                        </div>
                                      ) : null}
                                      <div>
                                        <p>answered {formatQuestionTime(answer.created_at)}</p>
                                        <p>
                                          <button
                                            type="button"
                                            onClick={() => onOpenUserProfile?.(answer.user)}
                                            className="transition hover:text-cyan-200 hover:underline"
                                          >
                                            {answer.user_name}
                                          </button>
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <CommentSection
                                targetType="answer"
                                targetId={answer.id}
                                commentsCount={(answer.comments || []).length}
                                commentData={answerCommentData}
                                collapsed={Boolean(collapsedCommentSections[buildCommentKey('answer', answer.id)])}
                                onToggleCollapsed={() => toggleCommentSection('answer', answer.id)}
                                draftValue={commentDrafts[buildCommentKey('answer', answer.id)] || ''}
                                onDraftChange={(value) => handleCommentDraftChange('answer', answer.id, value)}
                                onAddComment={() => handleAddComment('answer', answer.id, answer.id)}
                                errorMessage={commentErrors[buildCommentKey('answer', answer.id)]}
                                showDeletedTree={Boolean(showDeletedTrees[buildCommentKey('answer', answer.id)])}
                                onShowDeletedTree={() =>
                                  setShowDeletedTrees((prev) => ({
                                    ...prev,
                                    [buildCommentKey('answer', answer.id)]: true,
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
                                formatTime={formatQuestionTime}
                                getCommentKey={buildCommentKey}
                                getCommentItemKey={buildCommentItemKey}
                                containerClassName="mt-3 max-w-lg"
                              />
                              <div className="mt-3 border-t border-white/15" />
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-400">No answers yet.</p>
            )}

            {showAnswerSection && !selectedQuestion.closed_reason && !selectedQuestion.delete_flag ? (
              <div className="w-full rounded-2xl border border-white/10 bg-black/20 p-4">
                <form onSubmit={handleAnswerSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-200">Your Answer</label>
                    <textarea
                      value={answerBody}
                      onChange={(e) => setAnswerBody(e.target.value)}
                      className="min-h-[150px] w-full rounded-3xl border border-white/15 bg-black/20 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                      placeholder="Write your answer here..."
                      required
                    />
                  </div>

                  {answerError ? (
                    <p className="rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
                      {answerError}
                    </p>
                  ) : null}

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={submittingAnswer}
                      className="rounded-full bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submittingAnswer ? 'Posting...' : 'Post Answer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAnswerSection(false);
                        setAnswerError('');
                      }}
                      className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/20"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : null}

            {!selectedQuestion.closed_reason && !selectedQuestion.delete_flag ? (
              <div className="mt-3 flex flex-col items-start gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAnswerError('');
                    setShowAnswerSection(true);
                  }}
                  className="rounded-full bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  Answer this question
                </button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

export default QuestionDetailPanel;
