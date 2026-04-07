import { useCallback, useEffect, useMemo, useState } from 'react';
import { postService, voteService } from '../../services/api';

function useQuestionListDomain({
  teamId,
  selectedQuestion,
  setSelectedQuestion,
  resetQuestionDetailState,
  getQuestionIdFromUrl,
  setQuestionIdInUrl,
}) {
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [listError, setListError] = useState('');
  const [questionFilter, setQuestionFilter] = useState('newest');
  const [selectedTagFilter, setSelectedTagFilter] = useState('');

  const loadQuestions = useCallback(async () => {
    if (!teamId) {
      setQuestions([]);
      return;
    }

    setLoadingQuestions(true);
    setListError('');

    try {
      const data = await postService.listQuestions(teamId);
      setQuestions(Array.isArray(data) ? data : []);
    } catch (err) {
      setListError(err.response?.data?.error || 'Failed to load questions.');
    } finally {
      setLoadingQuestions(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const visibleQuestions = useMemo(() => {
    let next = [...questions];

    if (selectedTagFilter) {
      const selectedTag = selectedTagFilter.toLowerCase();
      next = next.filter((question) =>
        (question.tags || []).some((tag) => String(tag.name || '').toLowerCase() === selectedTag)
      );
    }

    if (questionFilter === 'unanswered') {
      next = next.filter((question) => Number(question.answer_count || 0) === 0);
    }

    if (questionFilter === 'bounty') {
      next = next.filter((question) => (question.bounty_amount || 0) > 0);
    }

    if (questionFilter === 'active') {
      next.sort((a, b) => {
        const aTime = new Date(a.latest_activity_at || a.created_at || 0).getTime();
        const bTime = new Date(b.latest_activity_at || b.created_at || 0).getTime();
        return bTime - aTime;
      });
      return next;
    }

    next.sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return bTime - aTime;
    });

    return next;
  }, [questions, questionFilter, selectedTagFilter]);

  const questionTagCounts = useMemo(() => {
    const counts = new Map();

    (questions || []).forEach((question) => {
      (question.tags || []).forEach((tag) => {
        const name = String(tag.name || '').trim();
        if (!name) {
          return;
        }

        counts.set(name, (counts.get(name) || 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a.name.localeCompare(b.name);
      });
  }, [questions]);

  const openQuestionDetail = useCallback(async (questionId, updateUrl = false) => {
    setListError('');

    try {
      const data = await postService.getQuestionDetail(questionId);
      setQuestions((prev) =>
        prev.map((question) =>
          question.id === questionId
            ? {
                ...question,
                views_count: data.views_count,
                vote_count: data.vote_count,
                bookmarks_count: data.bookmarks_count,
                current_user_vote: data.current_user_vote,
                is_bookmarked: data.is_bookmarked,
                delete_flag: data.delete_flag,
              }
            : question
        )
      );
      resetQuestionDetailState();
      setSelectedQuestion(data);
      if (updateUrl) {
        setQuestionIdInUrl(questionId);
      }
    } catch (err) {
      setListError(err.response?.data?.error || 'Failed to open question.');
    }
  }, [resetQuestionDetailState, setQuestionIdInUrl, setSelectedQuestion]);

  const handleOpenQuestion = useCallback((questionId) => {
    openQuestionDetail(questionId, true);
  }, [openQuestionDetail]);

  const handleListQuestionUpvote = useCallback(async (questionId) => {
    const question = questions.find((item) => item.id === questionId);
    if (!question) {
      return;
    }

    const currentVote = Number(question.current_user_vote || 0);

    try {
      setListError('');
      const result =
        currentVote === 1
          ? await voteService.removeVote({ postId: questionId })
          : await voteService.submitVote({ postId: questionId, vote: 1 });

      setQuestions((prev) =>
        prev.map((item) =>
          item.id === questionId
            ? {
                ...item,
                vote_count: result.vote_count,
                current_user_vote: result.vote,
              }
            : item
        )
      );

      setSelectedQuestion((prev) =>
        prev && prev.id === questionId
          ? {
              ...prev,
              vote_count: result.vote_count,
              current_user_vote: result.vote,
            }
          : prev
      );
    } catch (err) {
      setListError(err.response?.data?.error || 'Failed to vote on question.');
    }
  }, [questions, setSelectedQuestion]);

  const handleToggleQuestionBookmark = useCallback(async (questionId, collectionId = null) => {
    const question = questions.find((item) => item.id === questionId);
    const isBookmarked =
      question?.is_bookmarked ||
      (selectedQuestion?.id === questionId && selectedQuestion.is_bookmarked);

    try {
      setListError('');
      if (isBookmarked) {
        await postService.removeBookmark({ postId: questionId });
      } else {
        await postService.addBookmark({
          post_id: questionId,
          collection_id: collectionId,
        });
      }

      setQuestions((prev) =>
        prev.map((item) =>
          item.id === questionId
            ? {
                ...item,
                bookmarks_count: Math.max((item.bookmarks_count || 0) + (isBookmarked ? -1 : 1), 0),
                is_bookmarked: !isBookmarked,
              }
            : item
        )
      );

      setSelectedQuestion((prev) =>
        prev && prev.id === questionId
          ? {
              ...prev,
              bookmarks_count: Math.max((prev.bookmarks_count || 0) + (isBookmarked ? -1 : 1), 0),
              is_bookmarked: !isBookmarked,
            }
          : prev
      );
    } catch (err) {
      setListError(err.response?.data?.error || 'Failed to update bookmark.');
    }
  }, [questions, selectedQuestion, setSelectedQuestion]);

  const handleBackToQuestions = useCallback(() => {
    if (getQuestionIdFromUrl()) {
      setQuestionIdInUrl(null, true);
    }

    resetQuestionDetailState();
    setSelectedQuestion(null);
  }, [getQuestionIdFromUrl, resetQuestionDetailState, setQuestionIdInUrl, setSelectedQuestion]);

  const handleApplyTagFilter = useCallback((tagName) => {
    if (!tagName) {
      return;
    }

    setSelectedTagFilter(tagName);
    if (selectedQuestion) {
      handleBackToQuestions();
    }
  }, [handleBackToQuestions, selectedQuestion]);

  useEffect(() => {
    const syncFromUrl = async () => {
      const urlQuestionId = getQuestionIdFromUrl();

      if (!urlQuestionId) {
        if (selectedQuestion) {
          resetQuestionDetailState();
          setSelectedQuestion(null);
        }
        return;
      }

      if (selectedQuestion?.id === urlQuestionId) {
        return;
      }

      await openQuestionDetail(urlQuestionId, false);
    };

    syncFromUrl();

    const onPopState = () => {
      syncFromUrl();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [
    getQuestionIdFromUrl,
    openQuestionDetail,
    resetQuestionDetailState,
    selectedQuestion,
    setSelectedQuestion,
    teamId,
  ]);

  return {
    questions,
    setQuestions,
    loadingQuestions,
    setLoadingQuestions,
    listError,
    setListError,
    questionFilter,
    setQuestionFilter,
    selectedTagFilter,
    setSelectedTagFilter,
    loadQuestions,
    visibleQuestions,
    questionTagCounts,
    openQuestionDetail,
    handleOpenQuestion,
    handleListQuestionUpvote,
    handleToggleQuestionBookmark,
    handleBackToQuestions,
    handleApplyTagFilter,
  };
}

export default useQuestionListDomain;
