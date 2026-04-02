function PostComposerModal({
  open,
  modalTitle,
  modalSubtitle = '',
  onSubmit,
  titleValue,
  onTitleChange,
  titlePlaceholder,
  bodyValue,
  onBodyChange,
  bodyPlaceholder,
  bodyMinHeightClassName = 'min-h-[180px]',
  extraFields = null,
  tags,
  onRemoveTag,
  tagInput,
  onTagInputChange,
  onTagKeyDown,
  tagSuggestions,
  searchingTags,
  onAddTag,
  tagError,
  formError,
  isSubmitting,
  submitLabel,
  submittingLabel,
  cancelLabel,
  onClose,
  panelClassName = 'w-full max-w-2xl rounded-[2rem] border border-white/10 bg-[#111821] p-6 shadow-2xl shadow-black/50 sm:p-8',
  fieldBorderClassName = 'border-white/15',
  submitButtonClassName = 'rounded-full bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60',
  closeButtonClassName = 'rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/20',
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className={panelClassName}>
        <div className={modalSubtitle ? 'mb-5' : 'mb-2'}>
          <h3 className="text-2xl font-semibold text-white">{modalTitle}</h3>
          {modalSubtitle ? <p className="mt-1 text-sm text-slate-300">{modalSubtitle}</p> : null}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-200">Title</label>
            <input
              type="text"
              value={titleValue}
              onChange={(e) => onTitleChange(e.target.value)}
              className={`w-full rounded-full border ${fieldBorderClassName} bg-black/20 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30`}
              placeholder={titlePlaceholder}
              required
            />
          </div>

          {extraFields}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-200">Body</label>
            <textarea
              value={bodyValue}
              onChange={(e) => onBodyChange(e.target.value)}
              className={`${bodyMinHeightClassName} w-full rounded-3xl border ${fieldBorderClassName} bg-black/20 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30`}
              placeholder={bodyPlaceholder}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-200">
              Tags <span className="text-slate-400">(max 5)</span>
            </label>

            <div className="mb-0.5 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-2 rounded-sm border border-cyan-300/0 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-400"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => onRemoveTag(tag)}
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
                value={tagInput}
                onChange={(e) => onTagInputChange(e.target.value)}
                onKeyDown={onTagKeyDown}
                className={`w-full rounded-full border ${fieldBorderClassName} bg-black/25 px-4 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30`}
                placeholder="Type a tag and press Space"
              />

              {(tagSuggestions.length > 0 || searchingTags) && tagInput.trim() ? (
                <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-white/15 bg-[#0f141c] shadow-lg shadow-black/40">
                  {searchingTags ? (
                    <p className="px-3 py-2 text-xs text-slate-400">Searching tags...</p>
                  ) : (
                    <ul className="max-h-48 overflow-y-auto py-1">
                      {tagSuggestions.map((tag) => (
                        <li key={tag.id}>
                          <button
                            type="button"
                            onClick={() => onAddTag(tag.name)}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10"
                          >
                            <span>{tag.name}</span>
                            <span className="text-xs text-slate-400">
                              {Number(tag.question_count || 0) + Number(tag.article_count || 0)} posts
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {tagError ? (
            <p className="rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
              {tagError}
            </p>
          ) : null}

          {formError ? (
            <p className="rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
              {formError}
            </p>
          ) : null}

          <div className={`flex items-center gap-2 pt-1`}>
            <button type="submit" disabled={isSubmitting} className={submitButtonClassName}>
                {isSubmitting ? submittingLabel : submitLabel}
            </button>
            <button type="button" onClick={onClose} className={closeButtonClassName}>
                {cancelLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PostComposerModal;
