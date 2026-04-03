function TagPreferencesPanel({
  watchingTags,
  ignoredTags,
  watchTagInput,
  onWatchTagInputChange,
  watchSuggestions,
  onAddWatchTag,
  ignoreTagInput,
  onIgnoreTagInputChange,
  ignoreSuggestions,
  onAddIgnoreTag,
  onTagSelect,
  onSetTagPreference,
  updatingTagPreferenceKey,
  loading,
  error,
}) {
  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
        <h3 className="text-xs font-semibold tracking-[0.12em] text-slate-300 uppercase">Watching Tags</h3>

        <div className="mt-2 flex flex-wrap gap-2">
          {watchingTags.length === 0 ? (
            <p className="text-xs text-slate-400">No watching tags yet.</p>
          ) : (
            watchingTags.map((tag) => (
              <span key={`watch-${tag.tag_id}`} className="inline-flex items-center gap-1 rounded-sm border border-emerald-300/0 bg-emerald-300/10 px-2.5 py-0.5 text-[11px] text-emerald-200">
                <button
                  type="button"
                  onClick={() => onTagSelect(tag.tag_name || '')}
                  className="transition hover:text-white"
                >
                  {tag.tag_name}
                </button>
                <button
                  type="button"
                  onClick={() => onSetTagPreference({ tagId: tag.tag_id, field: 'is_watching', value: false })}
                  disabled={updatingTagPreferenceKey === `is_watching:${tag.tag_id}`}
                  className="text-emerald-200 transition hover:text-white disabled:opacity-60"
                  aria-label={`Remove ${tag.tag_name} from watching`}
                >
                  x
                </button>
              </span>
            ))
          )}
        </div>

        <div className="mt-3">
          <input
            type="text"
            value={watchTagInput}
            onChange={(event) => onWatchTagInputChange(event.target.value)}
            className="w-full rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70"
            placeholder="Add watching tag"
          />
          {watchSuggestions.length > 0 ? (
            <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-[#0f141c] p-2">
              {watchSuggestions.map((tag) => (
                <button
                  key={`watch-suggest-${tag.id}`}
                  type="button"
                  onClick={() => onAddWatchTag(tag)}
                  className="block w-full rounded-lg px-2 py-1 text-left text-xs text-slate-200 transition hover:bg-white/10"
                >
                  {tag.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
        <h3 className="text-xs font-semibold tracking-[0.12em] text-slate-300 uppercase">Ignored Tags</h3>

        <div className="mt-2 flex flex-wrap gap-2">
          {ignoredTags.length === 0 ? (
            <p className="text-xs text-slate-400">No ignored tags yet.</p>
          ) : (
            ignoredTags.map((tag) => (
              <span key={`ignore-${tag.tag_id}`} className="inline-flex items-center gap-1 rounded-sm border border-rose-300/0 bg-rose-300/10 px-2.5 py-0.5 text-[11px] text-rose-200">
                <button
                  type="button"
                  onClick={() => onTagSelect(tag.tag_name || '')}
                  className="transition hover:text-white"
                >
                  {tag.tag_name}
                </button>
                <button
                  type="button"
                  onClick={() => onSetTagPreference({ tagId: tag.tag_id, field: 'is_ignored', value: false })}
                  disabled={updatingTagPreferenceKey === `is_ignored:${tag.tag_id}`}
                  className="text-rose-200 transition hover:text-white disabled:opacity-60"
                  aria-label={`Remove ${tag.tag_name} from ignored`}
                >
                  x
                </button>
              </span>
            ))
          )}
        </div>

        <div className="mt-3">
          <input
            type="text"
            value={ignoreTagInput}
            onChange={(event) => onIgnoreTagInputChange(event.target.value)}
            className="w-full rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70"
            placeholder="Add ignored tag"
          />
          {ignoreSuggestions.length > 0 ? (
            <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-[#0f141c] p-2">
              {ignoreSuggestions.map((tag) => (
                <button
                  key={`ignore-suggest-${tag.id}`}
                  type="button"
                  onClick={() => onAddIgnoreTag(tag)}
                  className="block w-full rounded-lg px-2 py-1 text-left text-xs text-slate-200 transition hover:bg-white/10"
                >
                  {tag.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {loading ? <p className="text-xs text-slate-400">Loading tag preferences...</p> : null}
      {error ? (
        <p className="rounded-full border border-rose-400/40 bg-rose-500/15 px-3 py-1 text-xs text-rose-200">
          {error}
        </p>
      ) : null}
    </>
  );
}

export default TagPreferencesPanel;
