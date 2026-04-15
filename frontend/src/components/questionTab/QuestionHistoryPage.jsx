function QuestionHistoryPage({ controller, onOpenUserProfile }) {
  const {
    selectedQuestion,
    questionActivities,
    questionActivityPagination,
    loadingQuestionActivities,
    questionActivityError,
    formatQuestionTime,
    handleCloseQuestionHistoryPage,
    handleOpenHistoryReference,
  } = controller;

  if (!selectedQuestion) {
    return null;
  }

  const actorNode = (activity) => {
    if (!activity.actor) {
      return <span className="text-slate-300">system</span>;
    }

    return (
      <button
        type="button"
        onClick={() => onOpenUserProfile?.(activity.actor)}
        className="font-medium text-cyan-200 transition hover:text-cyan-100 hover:underline"
      >
        {activity.actor_name}
      </button>
    );
  };

  const answerRefNode = (activity, label = 'answer') => {
    if (!activity.answer) {
      return label;
    }

    return (
      <button
        type="button"
        onClick={() => handleOpenHistoryReference('answer', activity.answer)}
        className="font-medium text-cyan-200 transition hover:text-cyan-100 hover:underline"
      >
        {label}
      </button>
    );
  };

  const commentRefNode = (activity, label = 'comment') => {
    if (!activity.comment) {
      return label;
    }

    return (
      <button
        type="button"
        onClick={() => handleOpenHistoryReference('comment', activity.comment)}
        className="font-medium text-cyan-200 transition hover:text-cyan-100 hover:underline"
      >
        {label}
      </button>
    );
  };

  const renderActivityMessage = (activity) => {
    switch (activity.action) {
      case 'post_created':
        return <>{actorNode(activity)} created this post</>;
      case 'post_edited':
        return <>{actorNode(activity)} edited this post</>;
      case 'commented':
        if (activity.answer) {
          return (
            <>
              {actorNode(activity)} posted a {commentRefNode(activity)} on an {answerRefNode(activity)}
            </>
          );
        }
        return <>{actorNode(activity)} posted a {commentRefNode(activity)} on this post</>;
      case 'answered':
        return <>{actorNode(activity)} posted an {answerRefNode(activity)}</>;
      case 'post_deleted':
        return activity.answer
          ? <>{actorNode(activity)} deleted an {answerRefNode(activity)}</>
          : <>{actorNode(activity)} deleted this post</>;
      case 'post_undeleted':
        return activity.answer
          ? <>{actorNode(activity)} undeleted an {answerRefNode(activity)}</>
          : <>{actorNode(activity)} undeleted this post</>;
      case 'post_closed':
        return <>{actorNode(activity)} closed this post</>;
      case 'post_reopened':
        return <>{actorNode(activity)} reopened this post</>;
      case 'bounty_started':
        return <>{actorNode(activity)} started a bounty</>;
      case 'bounty_ended':
        return activity.answer
          ? <>{actorNode(activity)} ended the bounty and awarded an {answerRefNode(activity)}</>
          : <>{actorNode(activity)} ended the bounty</>;
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
