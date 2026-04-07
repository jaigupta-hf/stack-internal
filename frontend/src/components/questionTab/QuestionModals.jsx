import PostComposerModal from '../PostComposerModal';

function QuestionModals({ controller, embeddedMode = false, onOpenUserProfile }) {
  const {
    showAskModal,
    setShowAskModal,
    handleQuestionSubmit,
    questionTitle,
    setQuestionTitle,
    questionBody,
    setQuestionBody,
    questionTags,
    removeTag,
    tagInput,
    setTagInput,
    sanitizeTagName,
    addTag,
    tagSuggestions,
    searchingTags,
    tagError,
    questionError,
    submittingQuestion,
    setQuestionError,
    setTagError,
    setQuestionTags,
    setTagSuggestions,
    showCloseModal,
    setShowCloseModal,
    selectedQuestion,
    closeReason,
    setCloseReason,
    setCloseError,
    duplicateQuery,
    setDuplicateQuery,
    setSelectedDuplicate,
    searchingDuplicate,
    duplicateMatches,
    selectedDuplicate,
    closeError,
    handleCloseQuestion,
    closingQuestion,
    setDuplicateMatches,
    showBountyModal,
    setShowBountyModal,
    BOUNTY_REASONS,
    selectedBountyReason,
    setSelectedBountyReason,
    handleOfferBounty,
    offeringBounty,
    setOfferingBounty,
  } = controller;

  return (
    <>
      <PostComposerModal
        open={showAskModal && !embeddedMode}
        modalTitle="Ask a question"
        onSubmit={handleQuestionSubmit}
        titleValue={questionTitle}
        onTitleChange={setQuestionTitle}
        titlePlaceholder="What issue are you facing?"
        bodyValue={questionBody}
        onBodyChange={setQuestionBody}
        bodyPlaceholder="Describe your question with all relevant details..."
        bodyMinHeightClassName="min-h-[180px]"
        tags={questionTags}
        onRemoveTag={removeTag}
        tagInput={tagInput}
        onTagInputChange={(value) => {
          setTagError('');
          setTagInput(sanitizeTagName(value));
        }}
        onTagKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
            e.preventDefault();
            addTag(tagInput);
          }
        }}
        tagSuggestions={tagSuggestions}
        searchingTags={searchingTags}
        onAddTag={addTag}
        tagError={tagError}
        formError={questionError}
        isSubmitting={submittingQuestion}
        submitLabel="Post Question"
        submittingLabel="Posting..."
        cancelLabel="Cancel"
        onClose={() => {
          setShowAskModal(false);
          setQuestionError('');
          setTagError('');
          setQuestionTags([]);
          setTagInput('');
          setTagSuggestions([]);
        }}
        panelClassName="w-full max-w-2xl rounded-[2rem] border border-white/5 bg-[#111821] p-6 shadow-2xl shadow-black/50 sm:p-6"
        fieldBorderClassName="border-white/10"
        submitButtonClassName="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        closeButtonClassName="rounded-full border border-white/0 bg-white/10 px-5 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/20"
      />

      {showCloseModal && selectedQuestion ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#111821] p-6 shadow-2xl shadow-black/50 sm:p-8">
            <h3 className="text-2xl font-semibold text-white">Close question</h3>
            <p className="mt-1 text-sm text-slate-300">Choose a reason. Closed questions do not accept new answers.</p>

            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="radio"
                  name="closeReason"
                  value="duplicate"
                  checked={closeReason === 'duplicate'}
                  onChange={() => {
                    setCloseReason('duplicate');
                    setCloseError('');
                  }}
                  className="h-4 w-4"
                />
                Duplicate
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="radio"
                  name="closeReason"
                  value="off-topic"
                  checked={closeReason === 'off-topic'}
                  onChange={() => {
                    setCloseReason('off-topic');
                    setCloseError('');
                  }}
                  className="h-4 w-4"
                />
                Off-topic
              </label>
            </div>

            {closeReason === 'duplicate' ? (
              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-slate-200">Search duplicate question by title</label>
                <input
                  type="text"
                  value={duplicateQuery}
                  onChange={(e) => {
                    setDuplicateQuery(e.target.value);
                    setSelectedDuplicate(null);
                    setCloseError('');
                  }}
                  className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                  placeholder="Search by question title"
                />

                {searchingDuplicate ? <p className="mt-2 text-xs text-slate-400">Searching questions...</p> : null}

                {!searchingDuplicate && duplicateQuery.trim() && duplicateMatches.length > 0 ? (
                  <ul className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-2">
                    {duplicateMatches.map((match) => (
                      <li key={match.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedDuplicate(match)}
                          className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                            selectedDuplicate?.id === match.id
                              ? 'bg-cyan-400/20 text-cyan-100'
                              : 'text-slate-200 hover:bg-white/10'
                          }`}
                        >
                          <span className={`block font-medium ${match.delete_flag ? 'text-rose-300' : ''}`}>
                            {match.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-400">
                            by{' '}
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenUserProfile?.(match.user_id || match.user);
                              }}
                              className="font-medium text-slate-300 transition hover:text-cyan-200 hover:underline"
                            >
                              {match.user_name}
                            </button>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {!searchingDuplicate && duplicateQuery.trim() && duplicateMatches.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">No matching questions found.</p>
                ) : null}

                {selectedDuplicate ? (
                  <p className="mt-2 text-xs text-cyan-200">Selected duplicate: #{selectedDuplicate.id}</p>
                ) : null}
              </div>
            ) : null}

            {closeError ? (
              <p className="mt-4 rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
                {closeError}
              </p>
            ) : null}

            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleCloseQuestion}
                disabled={closingQuestion}
                className="rounded-full bg-cyan-500 px-5 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {closingQuestion ? 'Closing...' : 'Close question'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCloseModal(false);
                  setCloseError('');
                  setDuplicateQuery('');
                  setDuplicateMatches([]);
                  setSelectedDuplicate(null);
                }}
                className="rounded-full border border-white/0 bg-white/10 px-5 py-1.5 text-sm font-medium text-slate-200 transition hover:bg-white/20"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showBountyModal && selectedQuestion ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#111821] p-6 shadow-2xl shadow-black/50 sm:p-8">
            <h3 className="text-2xl font-semibold text-white">Offer bounty</h3>
            <p className="mt-1 text-sm text-slate-300">Choose one reason for offering +50 bounty on this question.</p>

            <div className="mt-4 space-y-2">
              {BOUNTY_REASONS.map((item) => (
                <label
                  key={item.title}
                  className={`block cursor-pointer rounded-2xl border px-4 py-3 transition ${
                    selectedBountyReason === item.title
                      ? 'border-amber-300/40 bg-amber-500/10'
                      : 'border-white/10 bg-black/20 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="bountyReason"
                      value={item.title}
                      checked={selectedBountyReason === item.title}
                      onChange={() => setSelectedBountyReason(item.title)}
                      className="mt-1 h-4 w-4"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-100">{item.title}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{item.description}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleOfferBounty}
                disabled={offeringBounty}
                className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {offeringBounty ? 'Offering...' : 'Offer +50 bounty'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBountyModal(false);
                  setOfferingBounty(false);
                }}
                className="rounded-full border border-white/0 bg-white/10 px-5 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/20"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default QuestionModals;
