import VotePanel from './VotePanel';

function ListingCard({
  highlighted = false,
  score,
  currentVote,
  onUpvote,
  upvoteAriaLabel,
  isBookmarked,
  onToggleBookmark,
  bookmarkAriaLabel,
  neutralButtonClassName,
  children,
}) {
  return (
    <div
      className={`flex items-start gap-2 rounded-2xl border px-3 py-3 text-slate-100 ${
        highlighted ? 'border-slate-300/25 bg-slate-500/5' : 'border-white/10 bg-black/20'
      }`}
    >
      <VotePanel
        score={score}
        currentVote={currentVote}
        onUpvote={onUpvote}
        upvoteAriaLabel={upvoteAriaLabel}
        showBookmark
        isBookmarked={isBookmarked}
        onToggleBookmark={onToggleBookmark}
        bookmarkAriaLabel={bookmarkAriaLabel}
        neutralButtonClassName={neutralButtonClassName}
      />

      <div className="min-w-0 flex-1 text-left">{children}</div>
    </div>
  );
}

export default ListingCard;
