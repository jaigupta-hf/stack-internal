import ListingCard from '../ListingCard';
import TagPreferencesPanel from '../TagPreferencesPanel';

const QUESTION_PAGE_SIZE_OPTIONS = [10, 20, 40];

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

function QuestionListPanel({ controller, embeddedMode = false, onOpenUserProfile }) {
  const {
    selectedQuestion,
    handleBackToQuestions,
    setQuestionError,
    setTagError,
    setQuestionTags,
    setTagInput,
    setTagSuggestions,
    setShowAskModal,
    questionFilter,
    setQuestionFilter,
    selectedTagFilter,
    setSelectedTagFilter,
    questionPageSize,
    questionPagination,
    listError,
    loadingQuestions,
    questions,
    visibleQuestions,
    handleQuestionsPrevPage,
    handleQuestionsNextPage,
    handleQuestionsGoToPage,
    handleQuestionPageSizeChange,
    watchedTagIdSet,
    watchedTagNameSet,
    ignoredTagIdSet,
    ignoredTagNameSet,
    handleListQuestionUpvote,
    handleToggleQuestionBookmark,
    getCloseReasonLabel,
    handleOpenQuestion,
    handleApplyTagFilter,
    formatQuestionTime,
    watchingTags,
    ignoredTags,
    watchTagInput,
    setWatchTagInput,
    watchSuggestions,
    handleSetTagPreference,
    ignoreTagInput,
    setIgnoreTagInput,
    ignoreSuggestions,
    updatingTagPreferenceKey,
    loadingTagPreferences,
    tagPreferenceError,
    questionTagCounts,
  } = controller;

  if (embeddedMode) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {selectedQuestion ? (
            <button
              type="button"
              onClick={handleBackToQuestions}
              className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/20"
            >
              Back
            </button>
          ) : null}
          <h2 className="text-2xl font-semibold text-white">Questions</h2>
        </div>

        {!selectedQuestion ? (
          <button
            onClick={() => {
              setQuestionError('');
              setTagError('');
              setQuestionTags([]);
              setTagInput('');
              setTagSuggestions([]);
              setShowAskModal(true);
            }}
            className="rounded-full bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Ask a question
          </button>
        ) : null}
      </div>

      {!selectedQuestion ? (
        <>
          <p className="text-slate-300">Ask and manage team questions for this workspace.</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {[
              { key: 'newest', label: 'Newest' },
              { key: 'active', label: 'Active' },
              { key: 'unanswered', label: 'Unanswered' },
              { key: 'bounty', label: 'Bountied' },
            ].map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setQuestionFilter(filter.key)}
                className={`rounded-sm border px-3 py-0.5 text-xs font-medium transition ${
                  questionFilter === filter.key
                    ? 'border-cyan-300/0 bg-cyan-300/20 text-cyan-100'
                    : 'border-white/0 bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                {filter.label}
              </button>
            ))}

            {selectedTagFilter ? (
              <>
                <span className="rounded-full border border-cyan-300/0 bg-cyan-300/15 px-3 py-0.5 text-xs text-cyan-100">
                  Tag: {selectedTagFilter}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTagFilter('')}
                  className="rounded-full border border-white/0 bg-white/10 px-3 py-0.5 text-xs text-slate-300 transition hover:bg-white/20"
                >
                  Clear tag filter
                </button>
              </>
            ) : null}
          </div>

          {listError ? (
            <p className="mt-4 rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
              {listError}
            </p>
          ) : null}

          {loadingQuestions ? <p className="mt-6 text-slate-300">Loading questions...</p> : null}

          {!loadingQuestions && questions.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-10 text-center text-slate-400">
              No questions posted yet.
            </div>
          ) : null}

          {!loadingQuestions && questions.length > 0 && visibleQuestions.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-10 text-center text-slate-400">
              No questions match this filter.
            </div>
          ) : null}

          <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              {!loadingQuestions && visibleQuestions.length > 0 ? (
                <ul className="space-y-2">
                  {visibleQuestions.map((question) => {
                    const questionTags = question.tags || [];
                    const hasWatchedTag = questionTags.some((tag) => {
                      const tagId = Number(tag.id);
                      const tagName = String(tag.name || '').toLowerCase();
                      return watchedTagIdSet.has(tagId) || watchedTagNameSet.has(tagName);
                    });
                    const hasIgnoredTag = questionTags.some((tag) => {
                      const tagId = Number(tag.id);
                      const tagName = String(tag.name || '').toLowerCase();
                      return ignoredTagIdSet.has(tagId) || ignoredTagNameSet.has(tagName);
                    });

                    return (
                      <li key={question.id}>
                        <ListingCard
                          highlighted={hasWatchedTag}
                          score={question.vote_count}
                          currentVote={question.current_user_vote}
                          onUpvote={() => handleListQuestionUpvote(question.id)}
                          upvoteAriaLabel="Upvote question"
                          isBookmarked={Boolean(question.is_bookmarked)}
                          onToggleBookmark={() => handleToggleQuestionBookmark(question.id)}
                          bookmarkAriaLabel="Bookmark question"
                          neutralButtonClassName="border-white/10 bg-white/10 text-slate-200 hover:bg-white/20"
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                                question.approved_answer
                                  ? 'border-emerald-300/0 bg-emerald-400/20 text-emerald-300'
                                  : 'border-white/0 bg-white/10 text-slate-300'
                              }`}
                            >
                              {question.answer_count || 0} answers
                            </span>
                            <span className="rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                              {question.views_count || 0} views
                            </span>
                            {question.closed_reason ? (
                              <span className="rounded-full border border-rose-300/0 bg-rose-400/20 px-2.5 py-0.5 text-[11px] font-medium text-rose-200">
                                {getCloseReasonLabel(question.closed_reason)}
                              </span>
                            ) : null}
                            {(question.bounty_amount || 0) > 0 ? (
                              <span className="rounded-full border border-amber-300/0 bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-medium text-amber-100">
                                +{question.bounty_amount} bounty
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-start justify-between gap-4">
                            <button
                              type="button"
                              onClick={() => handleOpenQuestion(question.id)}
                              className={`text-left font-medium transition hover:underline ${
                                question.delete_flag
                                  ? 'text-rose-300 hover:text-rose-200'
                                  : hasIgnoredTag
                                    ? 'text-slate-400 hover:text-slate-300'
                                    : 'text-slate-100 hover:text-cyan-200'
                              }`}
                            >
                              {question.title}
                            </button>
                          </div>
                          <div className="flex items-start justify-between gap-4">
                            <p
                              className={`mt-1 text-sm ${question.delete_flag ? 'text-rose-300/80' : hasIgnoredTag ? 'text-slate-500' : 'text-slate-300'}`}
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {question.body}
                            </p>
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-4">
                            <div className="min-w-0 flex flex-wrap gap-2">
                              {question.tags && question.tags.length > 0
                                ? question.tags.map((tag) => (
                                    <button
                                      type="button"
                                      key={tag.id || tag.name}
                                      onClick={() => handleApplyTagFilter(tag.name || '')}
                                      className={`rounded-sm border px-2.5 py-0.5 text-[11px] font-medium ${
                                        question.delete_flag
                                          ? 'border-rose-300/30 bg-rose-400/10 text-rose-200'
                                          : hasIgnoredTag
                                            ? 'border-white/10 bg-white/10 text-slate-400'
                                            : 'border-cyan-300/0 bg-cyan-300/10 text-cyan-400'
                                      }`}
                                    >
                                      {tag.name}
                                    </button>
                                  ))
                                : null}
                            </div>
                            <p className="shrink-0 text-right text-xs text-slate-400">
                              <span>
                                <button
                                  type="button"
                                  onClick={() => onOpenUserProfile?.(question.user_id)}
                                  className="font-medium text-slate-300 transition hover:text-cyan-200 hover:underline"
                                >
                                  {question.user_name}
                                </button>
                                {question.user_is_admin ? (
                                  <span className="ml-1 rounded-full border border-amber-300/30 bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-200">
                                    Admin
                                  </span>
                                ) : null}{' '}
                                asked {formatQuestionTime(question.created_at)}
                              </span>
                            </p>
                          </div>
                        </ListingCard>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>

            <aside className="space-y-3">
              <TagPreferencesPanel
                watchingTags={watchingTags}
                ignoredTags={ignoredTags}
                watchTagInput={watchTagInput}
                onWatchTagInputChange={setWatchTagInput}
                watchSuggestions={watchSuggestions}
                onAddWatchTag={(tag) => {
                  handleSetTagPreference({ tagId: tag.id, field: 'is_watching', value: true });
                  setWatchTagInput('');
                }}
                ignoreTagInput={ignoreTagInput}
                onIgnoreTagInputChange={setIgnoreTagInput}
                ignoreSuggestions={ignoreSuggestions}
                onAddIgnoreTag={(tag) => {
                  handleSetTagPreference({ tagId: tag.id, field: 'is_ignored', value: true });
                  setIgnoreTagInput('');
                }}
                onTagSelect={handleApplyTagFilter}
                onSetTagPreference={handleSetTagPreference}
                updatingTagPreferenceKey={updatingTagPreferenceKey}
                loading={loadingTagPreferences}
                error={tagPreferenceError}
              />

              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <h3 className="text-xs font-semibold tracking-[0.12em] text-slate-300 uppercase">Related Tags</h3>

                <div className="mt-2 flex flex-wrap gap-2">
                  {questionTagCounts.length === 0 ? (
                    <p className="text-xs text-slate-400">No tags found in questions.</p>
                  ) : (
                    questionTagCounts.map((tag) => (
                      <button
                        key={`question-tag-count-${tag.name}`}
                        type="button"
                        onClick={() => handleApplyTagFilter(tag.name)}
                        className="rounded-sm border border-cyan-300/0 bg-cyan-300/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-400"
                      >
                        {tag.name} ({tag.count})
                      </button>
                    ))
                  )}
                </div>
              </div>
            </aside>
          </div>

          {!loadingQuestions && questionPagination ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-xs text-slate-300">
                Page {questionPagination.page} of {Math.max(questionPagination.total_pages || 1, 1)}
                {' '}•{' '}Total {questionPagination.total_items ?? questions.length} questions
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <span>Per page</span>
                  <select
                    value={questionPageSize}
                    onChange={(e) => handleQuestionPageSizeChange(e.target.value)}
                    className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-xs text-slate-100 outline-none"
                  >
                    {QUESTION_PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={`question-page-size-${option}`} value={option} className="bg-[#111821] text-slate-100">
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={handleQuestionsPrevPage}
                  disabled={!questionPagination.has_previous}
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={handleQuestionsNextPage}
                  disabled={!questionPagination.has_next}
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Next
                </button>

                {getVisiblePageNumbers(questionPagination).map((page) => (
                  <button
                    key={`question-page-${page}`}
                    type="button"
                    onClick={() => handleQuestionsGoToPage(page)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      page === questionPagination.page
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
    </div>
  );
}

export default QuestionListPanel;
