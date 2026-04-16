import { useCallback, useMemo, useState } from 'react';

import { postService } from '../../services/api';

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

  const [showVersionDiffModal, setShowVersionDiffModal] = useState(false);
  const [loadingVersionDiff, setLoadingVersionDiff] = useState(false);
  const [versionDiffError, setVersionDiffError] = useState('');
  const [versionDiffSnapshot, setVersionDiffSnapshot] = useState(null);

  if (!selectedQuestion) {
    return null;
  }

  const getTagNames = useCallback((tagsSnapshot) => {
    if (!Array.isArray(tagsSnapshot)) {
      return [];
    }

    return tagsSnapshot
      .map((tag) => {
        if (typeof tag === 'string') {
          return tag;
        }
        return tag?.name || '';
      })
      .filter(Boolean);
  }, []);

  const versionDiffSummary = useMemo(() => {
    if (!versionDiffSnapshot?.current) {
      return null;
    }

    const current = versionDiffSnapshot.current;
    const previous = versionDiffSnapshot.previous;

    const currentTags = getTagNames(current.tags_snapshot);
    const previousTags = previous ? getTagNames(previous.tags_snapshot) : [];
    const currentTagSet = new Set(currentTags);
    const previousTagSet = new Set(previousTags);

    const addedTags = currentTags.filter((tag) => !previousTagSet.has(tag));
    const removedTags = previousTags.filter((tag) => !currentTagSet.has(tag));

    return {
      current,
      previous,
      currentTags,
      previousTags,
      addedTags,
      removedTags,
      titleChanged: previous ? current.title !== previous.title : true,
      bodyChanged: previous ? current.body !== previous.body : true,
      tagsChanged: previous
        ? addedTags.length > 0 || removedTags.length > 0
        : currentTags.length > 0,
    };
  }, [getTagNames, versionDiffSnapshot]);

  const handleOpenVersionDiff = useCallback(async (postVersionId) => {
    if (!selectedQuestion?.id || !postVersionId) {
      return;
    }

    setShowVersionDiffModal(true);
    setLoadingVersionDiff(true);
    setVersionDiffError('');
    setVersionDiffSnapshot(null);

    try {
      const versions = await postService.listPostVersions(selectedQuestion.id);
      const current = versions.find((item) => item.id === postVersionId);
      if (!current) {
        setVersionDiffError('Version snapshot not found for this activity.');
        return;
      }

      const previous = versions.find((item) => item.version === current.version - 1) || null;
      setVersionDiffSnapshot({ current, previous });
    } catch (err) {
      setVersionDiffError(err.response?.data?.error || 'Failed to load version changes.');
    } finally {
      setLoadingVersionDiff(false);
    }
  }, [selectedQuestion?.id]);

  const handleCloseVersionDiff = useCallback(() => {
    setShowVersionDiffModal(false);
    setLoadingVersionDiff(false);
    setVersionDiffError('');
    setVersionDiffSnapshot(null);
  }, []);

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

  const versionRefNode = (activity, label = 'view changes') => {
    if (!activity.post_version) {
      return null;
    }

    return (
      <button
        type="button"
        onClick={() => handleOpenVersionDiff(activity.post_version)}
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
        return (
          <>
            {actorNode(activity)} edited this post
            {activity.post_version ? (
              <>
                {' '}
                ({versionRefNode(activity)})
              </>
            ) : null}
          </>
        );
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

      {showVersionDiffModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-[#111821] p-6 shadow-2xl shadow-black/50 sm:p-8">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-[0.08em] text-emerald-200 uppercase">
                  Version Changes
                </p>
                <h4 className="mt-1 text-xl font-semibold text-white">
                  {versionDiffSummary?.current
                    ? `Version ${versionDiffSummary.current.version}`
                    : 'Version snapshot'}
                </h4>
              </div>

              <button
                type="button"
                onClick={handleCloseVersionDiff}
                className="shrink-0 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/20"
              >
                Close
              </button>
            </div>

            {loadingVersionDiff ? (
              <p className="text-sm text-slate-300">Loading version changes...</p>
            ) : null}

            {!loadingVersionDiff && versionDiffError ? (
              <p className="rounded-full border border-amber-300/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
                {versionDiffError}
              </p>
            ) : null}

            {!loadingVersionDiff && !versionDiffError && versionDiffSummary ? (
              <div className="space-y-4">
                {versionDiffSummary.previous ? (
                  <p className="text-xs text-slate-300">
                    Comparing version {versionDiffSummary.current.version} with version {versionDiffSummary.previous.version}.
                  </p>
                ) : (
                  <p className="text-xs text-slate-300">No previous version is available for comparison.</p>
                )}

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs font-semibold tracking-[0.08em] text-slate-400 uppercase">Previous</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{versionDiffSummary.previous?.title || '-'}</p>
                    <p className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap text-sm text-slate-300">
                      {versionDiffSummary.previous?.body || '-'}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/5 p-4">
                    <p className="text-xs font-semibold tracking-[0.08em] text-cyan-200 uppercase">Current</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{versionDiffSummary.current.title || '-'}</p>
                    <p className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap text-sm text-slate-300">
                      {versionDiffSummary.current.body || '-'}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-semibold tracking-[0.08em] text-slate-400 uppercase">Change Summary</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-200">
                    <li>{versionDiffSummary.titleChanged ? 'Title changed' : 'Title unchanged'}</li>
                    <li>{versionDiffSummary.bodyChanged ? 'Body changed' : 'Body unchanged'}</li>
                    <li>{versionDiffSummary.tagsChanged ? 'Tags changed' : 'Tags unchanged'}</li>
                  </ul>

                  {versionDiffSummary.tagsChanged ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-emerald-200">Added tags</p>
                        <p className="mt-1 text-xs text-slate-300">
                          {versionDiffSummary.addedTags.length > 0 ? versionDiffSummary.addedTags.join(', ') : 'None'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-rose-200">Removed tags</p>
                        <p className="mt-1 text-xs text-slate-300">
                          {versionDiffSummary.removedTags.length > 0 ? versionDiffSummary.removedTags.join(', ') : 'None'}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default QuestionHistoryPage;
