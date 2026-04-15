function VotePanel({
  score,
  currentVote,
  onUpvote,
  onDownvote,
  upvoteAriaLabel = 'Upvote',
  downvoteAriaLabel = 'Downvote',
  upvoteDisabled = false,
  downvoteDisabled = false,
  showBookmark = false,
  isBookmarked = false,
  onToggleBookmark,
  bookmarkAriaLabel = 'Bookmark',
  bookmarkDisabled = false,
  showHistory = false,
  isHistoryActive = false,
  onToggleHistory,
  historyAriaLabel = 'Show history',
  historyDisabled = false,
  showBookmarkCount = false,
  bookmarkCount = 0,
  className = 'flex shrink-0 flex-col items-center gap-1 rounded-xl border border-white/0 bg-black/30 px-2 py-2',
  buttonBaseClassName = 'inline-flex h-7 w-7 items-center justify-center rounded-full border transition',
  neutralButtonClassName = 'border-white/10 bg-white/10 text-slate-200 hover:bg-white/15',
  activeUpvoteClassName = 'border-cyan-300/30 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-400/30',
  activeDownvoteClassName = 'border-rose-300/30 bg-rose-500/20 text-rose-100 hover:bg-rose-400/30',
  activeBookmarkClassName = 'border-amber-300/30 bg-amber-500/20 text-amber-100 hover:bg-amber-400/30',
  activeHistoryClassName = 'border-emerald-300/30 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-400/30',
  disabledClassName = 'cursor-not-allowed opacity-60 hover:bg-white/10',
  voteCountClassName = 'min-w-[2ch] text-center text-sm font-semibold text-cyan-100',
  bookmarkCountClassName = 'min-w-[2ch] text-center text-[11px] font-semibold text-amber-100',
}) {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onUpvote}
        disabled={upvoteDisabled}
        className={`${buttonBaseClassName} ${Number(currentVote || 0) === 1 ? activeUpvoteClassName : neutralButtonClassName} ${upvoteDisabled ? disabledClassName : ''}`}
        aria-label={upvoteAriaLabel}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
          <path d="m6 14 6-6 6 6" />
        </svg>
      </button>

      <span className={voteCountClassName}>{score || 0}</span>

      {onDownvote ? (
        <button
          type="button"
          onClick={onDownvote}
          disabled={downvoteDisabled}
          className={`${buttonBaseClassName} ${Number(currentVote || 0) === -1 ? activeDownvoteClassName : neutralButtonClassName} ${downvoteDisabled ? disabledClassName : ''}`}
          aria-label={downvoteAriaLabel}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="m6 10 6 6 6-6" />
          </svg>
        </button>
      ) : null}

      {showBookmark && onToggleBookmark ? (
        <button
          type="button"
          onClick={onToggleBookmark}
          disabled={bookmarkDisabled}
          className={`${buttonBaseClassName} ${isBookmarked ? activeBookmarkClassName : neutralButtonClassName} ${bookmarkDisabled ? disabledClassName : ''}`}
          aria-label={bookmarkAriaLabel}
        >
          <svg viewBox="0 0 24 24" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
          </svg>
        </button>
      ) : null}
      
      {showBookmarkCount ? <span className={bookmarkCountClassName}>{bookmarkCount || 0}</span> : null}

      {showHistory && onToggleHistory ? (
        <button
          type="button"
          onClick={onToggleHistory}
          disabled={historyDisabled}
          className={`${buttonBaseClassName} ${isHistoryActive ? activeHistoryClassName : neutralButtonClassName} ${historyDisabled ? disabledClassName : ''}`}
          aria-label={historyAriaLabel}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.708" />
            <path d="M3 3v6h6" />
            <path d="M12 7v5l3 2" />
          </svg>
        </button>
      ) : null}

    </div>
  );
}

export default VotePanel;
