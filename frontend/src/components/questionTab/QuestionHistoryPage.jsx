function QuestionHistoryPage({ controller }) {
  const {
    selectedQuestion,
    questionActivities,
    questionActivityPagination,
    loadingQuestionActivities,
    questionActivityError,
    formatQuestionTime,
    handleCloseQuestionHistoryPage,
  } = controller;

  if (!selectedQuestion) {
    return null;
  }

  const renderActivityMessage = (activity) => {
    const actorName = activity.actor_name || 'system';

    switch (activity.action) {
      case 'post_created':
        return `${actorName} created this post`;
      case 'post_edited':
        return `${actorName} edited this post`;
      case 'commented':
        return activity.answer
          ? `${actorName} commented on answer #${activity.answer}`
          : `${actorName} commented on this post`;
      case 'answered':
        return `${actorName} posted answer #${activity.answer}`;
      case 'post_deleted':
        return activity.answer
          ? `${actorName} deleted answer #${activity.answer}`
          : `${actorName} deleted this post`;
      case 'post_undeleted':
        return activity.answer
          ? `${actorName} undeleted answer #${activity.answer}`
          : `${actorName} undeleted this post`;
      case 'post_closed':
        return `${actorName} closed this post`;
      case 'post_reopened':
        return `${actorName} reopened this post`;
      case 'bounty_started':
        return `${actorName} started a bounty`;
      case 'bounty_ended':
        return activity.answer
          ? `${actorName} ended the bounty and awarded answer #${activity.answer}`
          : `${actorName} ended the bounty`;
      default:
        return activity.action_label || activity.action || 'Unknown activity';
    }
  };

  return (
    <div className="mt-6 w-full rounded-3xl border border-white/10 bg-[#111821] p-6 shadow-2xl shadow-black/35 sm:p-8">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-emerald-200 uppercase">
            Question History
          </p>
          <h3 className="mt-1 truncate text-2xl font-semibold text-white">{selectedQuestion.title}</h3>
        </div>

        <button
          type="button"
          onClick={handleCloseQuestionHistoryPage}
          className="shrink-0 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/20"
        >
          Back to question
        </button>
      </div>

      <div className="mb-4 border-t border-white/15" />

      {questionActivityPagination ? (
        <p className="mb-3 text-xs text-slate-300">
          {questionActivityPagination.total_items} events recorded
        </p>
      ) : null}

      {loadingQuestionActivities ? (
        <p className="text-sm text-slate-300">Loading event history...</p>
      ) : null}

      {!loadingQuestionActivities && questionActivityError ? (
        <p className="rounded-full border border-amber-300/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
          {questionActivityError}
        </p>
      ) : null}

      {!loadingQuestionActivities && !questionActivityError && questionActivities.length === 0 ? (
        <p className="text-sm text-slate-300">No events recorded yet.</p>
      ) : null}

      {!loadingQuestionActivities && !questionActivityError && questionActivities.length > 0 ? (
        <ul className="space-y-2">
          {questionActivities.map((activity) => (
            <li key={activity.id} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-100">{renderActivityMessage(activity)}</p>
                <span className="shrink-0 text-xs text-slate-400">{formatQuestionTime(activity.created_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default QuestionHistoryPage;
