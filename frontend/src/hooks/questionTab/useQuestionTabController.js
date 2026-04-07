import { useCallback, useEffect, useMemo, useState } from 'react';
import { postService, tagService, voteService } from '../../services/api';
import { buildCommentData, EMPTY_COMMENT_DATA } from '../../components/CommentSection';
import { formatVerboseRelativeTime } from '../../utils/dateTime';
import useEntityIdInUrl from '../useEntityIdInUrl';
import useCommentSectionState from '../useCommentSectionState';
import useTagPreferences from '../useTagPreferences';
import useThreadedComments from '../useThreadedComments';
import useQuestionAnswersDomain from './useQuestionAnswersDomain';
import useQuestionBountyDomain from './useQuestionBountyDomain';
import useQuestionMentionsDomain from './useQuestionMentionsDomain';
import useQuestionModerationDomain from './useQuestionModerationDomain';
import {
  BOUNTY_REASONS,
  formatQuestionTime,
  getCloseReasonLabel,
  isActuallyEdited,
} from './questionTabConstants';

const DEFAULT_QUESTION_LIST_PAGE_SIZE = 20;

function useQuestionTabController({ team }) {
  const [showAskModal, setShowAskModal] = useState(false);
  const [questionTitle, setQuestionTitle] = useState('');
  const [questionBody, setQuestionBody] = useState('');
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState('');
  const [tagError, setTagError] = useState('');
  const [questionTags, setQuestionTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [searchingTags, setSearchingTags] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [listError, setListError] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [isEditingQuestion, setIsEditingQuestion] = useState(false);
  const [isEditingTagsOnly, setIsEditingTagsOnly] = useState(false);
  const [editQuestionTitle, setEditQuestionTitle] = useState('');
  const [editQuestionBody, setEditQuestionBody] = useState('');
  const [editQuestionTags, setEditQuestionTags] = useState([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [editTagSuggestions, setEditTagSuggestions] = useState([]);
  const [searchingEditTags, setSearchingEditTags] = useState(false);
  const [editTagError, setEditTagError] = useState('');
  const [editQuestionError, setEditQuestionError] = useState('');
  const [savingQuestionEdit, setSavingQuestionEdit] = useState(false);
  const {
    commentDrafts,
    setCommentDrafts,
    commentErrors,
    setCommentErrors,
    collapsedCommentSections,
    setCollapsedCommentSections,
    activeCommentMenuKey,
    setActiveCommentMenuKey,
    editingCommentKey,
    setEditingCommentKey,
    editingCommentBody,
    setEditingCommentBody,
    replyDrafts,
    setReplyDrafts,
    activeReplyComposerKey,
    setActiveReplyComposerKey,
    showDeletedTrees,
    setShowDeletedTrees,
    resetCommentSectionState,
  } = useCommentSectionState();
  const [questionFilter, setQuestionFilter] = useState('newest');
  const [selectedTagFilter, setSelectedTagFilter] = useState('');
  const [questionPage, setQuestionPage] = useState(1);
  const [questionPageSize, setQuestionPageSize] = useState(DEFAULT_QUESTION_LIST_PAGE_SIZE);
  const [questionPagination, setQuestionPagination] = useState(null);
  const {
    getEntityIdFromUrl: getQuestionIdFromUrl,
    setEntityIdInUrl: setQuestionIdInUrl,
  } = useEntityIdInUrl('question');
  const {
    loadingTagPreferences,
    tagPreferenceError,
    updatingTagPreferenceKey,
    watchTagInput,
    setWatchTagInput,
    ignoreTagInput,
    setIgnoreTagInput,
    watchingTags,
    ignoredTags,
    watchSuggestions,
    ignoreSuggestions,
    watchedTagIdSet,
    watchedTagNameSet,
    ignoredTagIdSet,
    ignoredTagNameSet,
    handleSetTagPreference,
    loadTagPreferences,
  } = useTagPreferences({ teamId: team?.id, clearPreferencesOnLoadError: false });

  const loadQuestions = useCallback(async (requestedPage = questionPage, requestedPageSize = questionPageSize) => {
    if (!team?.id) {
      setQuestions([]);
      setQuestionPagination(null);
      return;
    }

    setLoadingQuestions(true);
    setListError('');

    try {
      const payload = await postService.listQuestionsPage(team.id, {
        page: requestedPage,
        pageSize: requestedPageSize,
      });

      const nextQuestions = Array.isArray(payload?.items) ? payload.items : [];
      const nextPagination = payload?.pagination ?? null;

      setQuestions(nextQuestions);
      setQuestionPagination(nextPagination);

      if (nextPagination?.total_pages && requestedPage > nextPagination.total_pages) {
        setQuestionPage(nextPagination.total_pages);
      }

      if (nextPagination?.total_pages === 0 && requestedPage !== 1) {
        setQuestionPage(1);
      }
    } catch (err) {
      setListError(err.response?.data?.error || 'Failed to load questions.');
      setQuestionPagination(null);
    } finally {
      setLoadingQuestions(false);
    }
  }, [questionPage, questionPageSize, team?.id]);

  useEffect(() => {
    setQuestionPage(1);
  }, [team?.id]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handleQuestionsPrevPage = useCallback(() => {
    setQuestionPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleQuestionsNextPage = useCallback(() => {
    setQuestionPage((prev) => {
      if (questionPagination && !questionPagination.has_next) {
        return prev;
      }
      return prev + 1;
    });
  }, [questionPagination]);

  const handleQuestionsGoToPage = useCallback((page) => {
    if (!questionPagination) {
      return;
    }

    const maxPage = Math.max(questionPagination.total_pages || 1, 1);
    const nextPage = Math.min(Math.max(page, 1), maxPage);
    setQuestionPage(nextPage);
  }, [questionPagination]);

  const handleQuestionPageSizeChange = useCallback((nextPageSize) => {
    const parsed = Number(nextPageSize);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }

    setQuestionPageSize(parsed);
    setQuestionPage(1);
  }, []);

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
      next = next.filter(
        (question) => (question.bounty_amount || 0) > 0
      );
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

  const {
    teamMembers,
    setTeamMembers,
    mentionSearchOpen,
    setMentionSearchOpen,
    mentionQuery,
    setMentionQuery,
    mentionLoading,
    setMentionLoading,
    mentionError,
    setMentionError,
    mentioningUserId,
    setMentioningUserId,
    removingMentionUserId,
    setRemovingMentionUserId,
    followingQuestion,
    setFollowingQuestion,
    mentionedUserIdSet,
    mentionCandidates,
    loadTeamMembers,
    handleToggleMentionSearch,
    handleMentionUser,
    handleRemoveMentionUser,
    handleToggleFollowQuestion,
  } = useQuestionMentionsDomain({
    teamId: team?.id,
    selectedQuestion,
    setSelectedQuestion,
    setListError,
  });

  const {
    showAnswerSection,
    setShowAnswerSection,
    answerBody,
    setAnswerBody,
    answerError,
    setAnswerError,
    submittingAnswer,
    setSubmittingAnswer,
    deletingAnswerId,
    setDeletingAnswerId,
    editingAnswerId,
    setEditingAnswerId,
    editAnswerBody,
    setEditAnswerBody,
    editAnswerError,
    setEditAnswerError,
    savingAnswerEdit,
    setSavingAnswerEdit,
    voteError,
    setVoteError,
    approvalError,
    setApprovalError,
    handleAnswerSubmit,
    handleStartAnswerEdit,
    handleSaveAnswerEdit,
    handleQuestionVote,
    handleDeleteAnswer,
    handleUndeleteAnswer,
    handleAnswerVote,
    handleApproveAnswer,
    sortedAnswers,
  } = useQuestionAnswersDomain({
    selectedQuestion,
    setSelectedQuestion,
    setQuestions,
  });

  const {
    showCloseModal,
    setShowCloseModal,
    closeReason,
    setCloseReason,
    closeError,
    setCloseError,
    closingQuestion,
    setClosingQuestion,
    deletingQuestion,
    setDeletingQuestion,
    duplicateQuery,
    setDuplicateQuery,
    duplicateMatches,
    setDuplicateMatches,
    searchingDuplicate,
    setSearchingDuplicate,
    selectedDuplicate,
    setSelectedDuplicate,
    handleOpenCloseModal,
    handleCloseQuestion,
    handleReopenQuestion,
    handleDeleteQuestion,
    handleUndeleteQuestion,
  } = useQuestionModerationDomain({
    teamId: team?.id,
    selectedQuestion,
    setSelectedQuestion,
    setQuestions,
    setShowAnswerSection,
    loadQuestions,
    setListError,
  });

  const {
    showBountyModal,
    setShowBountyModal,
    selectedBountyReason,
    setSelectedBountyReason,
    offeringBounty,
    setOfferingBounty,
    awardingBountyAnswerId,
    setAwardingBountyAnswerId,
    handleOfferBounty,
    handleAwardBounty,
  } = useQuestionBountyDomain({
    selectedQuestion,
    setSelectedQuestion,
    setQuestions,
    setApprovalError,
  });

  const resetQuestionDetailState = useCallback(() => {
    setIsEditingQuestion(false);
    setIsEditingTagsOnly(false);
    setEditQuestionError('');
    setShowAnswerSection(false);
    setAnswerError('');
    setAnswerBody('');
    setEditingAnswerId(null);
    setEditAnswerBody('');
    setEditAnswerError('');
    resetCommentSectionState();
    setVoteError('');
    setApprovalError('');
    setShowCloseModal(false);
    setCloseReason('off-topic');
    setCloseError('');
    setClosingQuestion(false);
    setDuplicateQuery('');
    setDuplicateMatches([]);
    setSearchingDuplicate(false);
    setSelectedDuplicate(null);
    setMentionSearchOpen(false);
    setMentionQuery('');
    setMentionError('');
    setMentioningUserId(null);
    setRemovingMentionUserId(null);
    setFollowingQuestion(false);
    setShowBountyModal(false);
    setSelectedBountyReason(BOUNTY_REASONS[0].title);
    setOfferingBounty(false);
    setAwardingBountyAnswerId(null);
  }, [
    resetCommentSectionState,
    setShowAnswerSection,
    setAnswerError,
    setAnswerBody,
    setEditingAnswerId,
    setEditAnswerBody,
    setEditAnswerError,
    setVoteError,
    setApprovalError,
    setShowCloseModal,
    setCloseReason,
    setCloseError,
    setClosingQuestion,
    setDuplicateQuery,
    setDuplicateMatches,
    setSearchingDuplicate,
    setSelectedDuplicate,
    setMentionSearchOpen,
    setMentionQuery,
    setMentionError,
    setMentioningUserId,
    setRemovingMentionUserId,
    setFollowingQuestion,
    setShowBountyModal,
    setSelectedBountyReason,
    setOfferingBounty,
    setAwardingBountyAnswerId,
  ]);

  const updateCommentCollection = (targetType, targetId, updater) => {
    setSelectedQuestion((prev) => {
      if (!prev) {
        return prev;
      }

      if (targetType === 'question') {
        return {
          ...prev,
          comments: updater(prev.comments || []),
        };
      }

      return {
        ...prev,
        answers: (prev.answers || []).map((answer) =>
          answer.id === targetId ? { ...answer, comments: updater(answer.comments || []) } : answer
        ),
      };
    });
  };

  const getQuestionTargetComments = useCallback(
    (targetType, targetId) =>
      targetType === 'question'
        ? selectedQuestion?.comments || []
        : (selectedQuestion?.answers || []).find((answer) => answer.id === targetId)?.comments || [],
    [selectedQuestion],
  );

  const {
    handleCommentDraftChange,
    handleAddComment,
    toggleCommentSection,
    toggleCommentMenu,
    toggleReplyComposer,
    handleReplyDraftChange,
    handleAddReply,
    handleStartCommentEdit,
    handleSaveCommentEdit,
    handleDeleteComment,
    handleCommentUpvote,
    cancelCommentEdit,
    cancelReplyComposer,
  } = useThreadedComments({
    commentDrafts,
    setCommentDrafts,
    setCommentErrors,
    setCollapsedCommentSections,
    setActiveCommentMenuKey,
    editingCommentKey,
    setEditingCommentKey,
    editingCommentBody,
    setEditingCommentBody,
    replyDrafts,
    setReplyDrafts,
    setActiveReplyComposerKey,
    updateCommentCollection,
    getTargetComments: getQuestionTargetComments,
    createCommentPayload: ({ postId, parentCommentId, body }) =>
      parentCommentId ? { parent_comment_id: parentCommentId, body } : { post_id: postId, body },
  });

  useEffect(() => {
    if (!isEditingQuestion) {
      return;
    }

    const query = editTagInput.trim();
    if (!query) {
      setEditTagSuggestions([]);
      return;
    }

    const debounce = setTimeout(async () => {
      setSearchingEditTags(true);
      try {
        const matches = await tagService.searchTags(query);
        const selected = new Set(editQuestionTags.map((tag) => tag.toLowerCase()));
        setEditTagSuggestions(matches.filter((tag) => !selected.has(tag.name.toLowerCase())));
      } catch {
        setEditTagSuggestions([]);
      } finally {
        setSearchingEditTags(false);
      }
    }, 250);

    return () => clearTimeout(debounce);
  }, [isEditingQuestion, editTagInput, editQuestionTags]);

  useEffect(() => {
    if (!showAskModal) {
      return;
    }

    const query = tagInput.trim();
    if (!query) {
      setTagSuggestions([]);
      return;
    }

    const debounce = setTimeout(async () => {
      setSearchingTags(true);
      try {
        const matches = await tagService.searchTags(query);
        const selected = new Set(questionTags.map((tag) => tag.toLowerCase()));
        setTagSuggestions(matches.filter((tag) => !selected.has(tag.name.toLowerCase())));
      } catch {
        setTagSuggestions([]);
      } finally {
        setSearchingTags(false);
      }
    }, 250);

    return () => clearTimeout(debounce);
  }, [showAskModal, tagInput, questionTags]);

  const sanitizeTagName = (value) => value.toLowerCase().replace(/[^a-z0-9-]/g, '');

  const normalizeTagName = (value) => sanitizeTagName(value).trim();

  const isNumericOnlyTag = (value) => /^\d+$/.test(value);

  const addTag = (rawValue) => {
    const cleaned = normalizeTagName(rawValue);
    if (!cleaned) {
      return;
    }

    if (isNumericOnlyTag(cleaned)) {
      setTagError('Tag name cannot contain only numbers.');
      return;
    }

    setTagError('');

    setQuestionTags((prev) => {
      if (prev.some((tag) => tag.toLowerCase() === cleaned.toLowerCase())) {
        return prev;
      }

      if (prev.length >= 5) {
        setTagError('Maximum 5 tags are allowed.');
        return prev;
      }

      return [...prev, cleaned];
    });

    setTagInput('');
    setTagSuggestions([]);
  };

  const removeTag = (tagToRemove) => {
    setQuestionTags((prev) => prev.filter((tag) => tag !== tagToRemove));
    setTagError('');
  };

  const handleQuestionSubmit = async (e) => {
    e.preventDefault();
    setQuestionError('');
    setTagError('');
    setSubmittingQuestion(true);

    const tagsForSubmit = [...questionTags];
    const pendingTag = normalizeTagName(tagInput);
    if (pendingTag) {
      if (isNumericOnlyTag(pendingTag)) {
        setTagError('Tag name cannot contain only numbers.');
        setSubmittingQuestion(false);
        return;
      }

      const alreadyPresent = tagsForSubmit.some((tag) => tag.toLowerCase() === pendingTag.toLowerCase());
      if (!alreadyPresent && tagsForSubmit.length >= 5) {
        setTagError('Maximum 5 tags are allowed.');
        setSubmittingQuestion(false);
        return;
      }

      if (!alreadyPresent) {
        tagsForSubmit.push(pendingTag);
      }
    }

    if (tagsForSubmit.length === 0) {
      setTagError('At least 1 tag is required.');
      setSubmittingQuestion(false);
      return;
    }

    try {
      await postService.createQuestion({
        team_id: team.id,
        title: questionTitle,
        body: questionBody,
        tags: tagsForSubmit,
      });
      setQuestionTitle('');
      setQuestionBody('');
      setQuestionTags([]);
      setTagInput('');
      setTagSuggestions([]);
      setTagError('');
      setShowAskModal(false);
      setQuestionPage(1);
      await loadQuestions(1);
      await loadTagPreferences();
    } catch (err) {
      setQuestionError(err.response?.data?.error || 'Failed to post question. Please try again.');
    } finally {
      setSubmittingQuestion(false);
    }
  };

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
  }, [resetQuestionDetailState, setQuestionIdInUrl]);

  const handleOpenQuestion = (questionId) => {
    openQuestionDetail(questionId, true);
  };

  const handleListQuestionUpvote = async (questionId) => {
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
  };

  const handleToggleQuestionBookmark = async (questionId, collectionId = null) => {
    const question = questions.find((item) => item.id === questionId);
    const isBookmarked = question?.is_bookmarked || (selectedQuestion?.id === questionId && selectedQuestion.is_bookmarked);

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
  };

  const handleBackToQuestions = () => {
    if (getQuestionIdFromUrl()) {
      setQuestionIdInUrl(null, true);
    }

    resetQuestionDetailState();
    setSelectedQuestion(null);
  };

  const handleApplyTagFilter = (tagName) => {
    if (!tagName) {
      return;
    }

    setSelectedTagFilter(tagName);
    if (selectedQuestion) {
      handleBackToQuestions();
    }
  };

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
  }, [team.id, selectedQuestion, getQuestionIdFromUrl, openQuestionDetail, resetQuestionDetailState]);

  const handleStartQuestionEdit = () => {
    if (!selectedQuestion) {
      return;
    }

    setEditQuestionTitle(selectedQuestion.title || '');
    setEditQuestionBody(selectedQuestion.body || '');
    setEditQuestionTags((selectedQuestion.tags || []).map((tag) => tag.name));
    setEditTagInput('');
    setEditTagSuggestions([]);
    setEditTagError('');
    setEditQuestionError('');
    setIsEditingTagsOnly(false);
    setIsEditingQuestion(true);
  };

  const handleStartTagsEdit = () => {
    if (!selectedQuestion) {
      return;
    }

    setEditQuestionTitle(selectedQuestion.title || '');
    setEditQuestionBody(selectedQuestion.body || '');
    setEditQuestionTags((selectedQuestion.tags || []).map((tag) => tag.name));
    setEditTagInput('');
    setEditTagSuggestions([]);
    setEditTagError('');
    setEditQuestionError('');
    setIsEditingTagsOnly(true);
    setIsEditingQuestion(true);
  };

  const addEditTag = (rawValue) => {
    const cleaned = normalizeTagName(rawValue);
    if (!cleaned) {
      return;
    }

    if (isNumericOnlyTag(cleaned)) {
      setEditTagError('Tag name cannot contain only numbers.');
      return;
    }

    setEditTagError('');
    setEditQuestionTags((prev) => {
      if (prev.some((tag) => tag.toLowerCase() === cleaned.toLowerCase())) {
        return prev;
      }

      if (prev.length >= 5) {
        setEditTagError('Maximum 5 tags are allowed.');
        return prev;
      }

      return [...prev, cleaned];
    });

    setEditTagInput('');
    setEditTagSuggestions([]);
  };

  const removeEditTag = (tagToRemove) => {
    setEditQuestionTags((prev) => prev.filter((tag) => tag !== tagToRemove));
    setEditTagError('');
  };

  const handleSaveQuestionEdit = async () => {
    if (!selectedQuestion) {
      return;
    }

    const tagsForSubmit = [...editQuestionTags];
    const pendingTag = normalizeTagName(editTagInput);
    if (pendingTag) {
      if (isNumericOnlyTag(pendingTag)) {
        setEditTagError('Tag name cannot contain only numbers.');
        return;
      }

      const exists = tagsForSubmit.some((tag) => tag.toLowerCase() === pendingTag.toLowerCase());
      if (!exists && tagsForSubmit.length >= 5) {
        setEditTagError('Maximum 5 tags are allowed.');
        return;
      }
      if (!exists) {
        tagsForSubmit.push(pendingTag);
      }
    }

    setEditQuestionError('');
    setEditTagError('');
    setSavingQuestionEdit(true);

    try {
      const updated = await postService.updateQuestion(selectedQuestion.id, {
        title: editQuestionTitle,
        body: editQuestionBody,
        tags: tagsForSubmit,
      });

      setSelectedQuestion(updated);
      setQuestions((prev) =>
        prev.map((question) =>
          question.id === updated.id
            ? { ...question, title: updated.title, body: updated.body, tags: updated.tags || question.tags }
            : question
        )
      );
      setEditTagInput('');
      setEditTagSuggestions([]);
      setEditQuestionTags((updated.tags || []).map((tag) => tag.name));
      setIsEditingTagsOnly(false);
      setIsEditingQuestion(false);
    } catch (err) {
      setEditQuestionError(err.response?.data?.error || 'Failed to update question.');
    } finally {
      setSavingQuestionEdit(false);
    }
  };

  const questionCommentData = selectedQuestion
    ? buildCommentData(selectedQuestion.comments)
    : EMPTY_COMMENT_DATA;

  return {
    showAskModal,
    setShowAskModal,
    questionTitle,
    setQuestionTitle,
    questionBody,
    setQuestionBody,
    submittingQuestion,
    setSubmittingQuestion,
    questionError,
    setQuestionError,
    tagError,
    setTagError,
    questionTags,
    setQuestionTags,
    tagInput,
    setTagInput,
    tagSuggestions,
    setTagSuggestions,
    searchingTags,
    setSearchingTags,
    questions,
    setQuestions,
    loadingQuestions,
    setLoadingQuestions,
    listError,
    setListError,
    selectedQuestion,
    setSelectedQuestion,
    isEditingQuestion,
    setIsEditingQuestion,
    isEditingTagsOnly,
    setIsEditingTagsOnly,
    editQuestionTitle,
    setEditQuestionTitle,
    editQuestionBody,
    setEditQuestionBody,
    editQuestionTags,
    setEditQuestionTags,
    editTagInput,
    setEditTagInput,
    editTagSuggestions,
    setEditTagSuggestions,
    searchingEditTags,
    setSearchingEditTags,
    editTagError,
    setEditTagError,
    editQuestionError,
    setEditQuestionError,
    savingQuestionEdit,
    setSavingQuestionEdit,
    showAnswerSection,
    setShowAnswerSection,
    answerBody,
    setAnswerBody,
    answerError,
    setAnswerError,
    submittingAnswer,
    setSubmittingAnswer,
    deletingAnswerId,
    setDeletingAnswerId,
    editingAnswerId,
    setEditingAnswerId,
    editAnswerBody,
    setEditAnswerBody,
    editAnswerError,
    setEditAnswerError,
    savingAnswerEdit,
    setSavingAnswerEdit,
    commentDrafts,
    setCommentDrafts,
    commentErrors,
    setCommentErrors,
    collapsedCommentSections,
    setCollapsedCommentSections,
    activeCommentMenuKey,
    setActiveCommentMenuKey,
    editingCommentKey,
    setEditingCommentKey,
    editingCommentBody,
    setEditingCommentBody,
    replyDrafts,
    setReplyDrafts,
    activeReplyComposerKey,
    setActiveReplyComposerKey,
    showDeletedTrees,
    setShowDeletedTrees,
    resetCommentSectionState,
    voteError,
    setVoteError,
    approvalError,
    setApprovalError,
    showCloseModal,
    setShowCloseModal,
    closeReason,
    setCloseReason,
    closeError,
    setCloseError,
    closingQuestion,
    setClosingQuestion,
    deletingQuestion,
    setDeletingQuestion,
    duplicateQuery,
    setDuplicateQuery,
    duplicateMatches,
    setDuplicateMatches,
    searchingDuplicate,
    setSearchingDuplicate,
    selectedDuplicate,
    setSelectedDuplicate,
    questionFilter,
    setQuestionFilter,
    selectedTagFilter,
    setSelectedTagFilter,
    questionPage,
    questionPageSize,
    questionPagination,
    teamMembers,
    setTeamMembers,
    mentionSearchOpen,
    setMentionSearchOpen,
    mentionQuery,
    setMentionQuery,
    mentionLoading,
    setMentionLoading,
    mentionError,
    setMentionError,
    mentioningUserId,
    setMentioningUserId,
    removingMentionUserId,
    setRemovingMentionUserId,
    followingQuestion,
    setFollowingQuestion,
    showBountyModal,
    setShowBountyModal,
    selectedBountyReason,
    setSelectedBountyReason,
    offeringBounty,
    setOfferingBounty,
    awardingBountyAnswerId,
    setAwardingBountyAnswerId,
    getQuestionIdFromUrl,
    setQuestionIdInUrl,
    loadingTagPreferences,
    tagPreferenceError,
    updatingTagPreferenceKey,
    watchTagInput,
    setWatchTagInput,
    ignoreTagInput,
    setIgnoreTagInput,
    watchingTags,
    ignoredTags,
    watchSuggestions,
    ignoreSuggestions,
    watchedTagIdSet,
    watchedTagNameSet,
    ignoredTagIdSet,
    ignoredTagNameSet,
    handleSetTagPreference,
    loadQuestions,
    handleQuestionsPrevPage,
    handleQuestionsNextPage,
    handleQuestionsGoToPage,
    handleQuestionPageSizeChange,
    visibleQuestions,
    questionTagCounts,
    resetQuestionDetailState,
    mentionedUserIdSet,
    mentionCandidates,
    loadTeamMembers,
    handleToggleMentionSearch,
    handleMentionUser,
    handleRemoveMentionUser,
    handleToggleFollowQuestion,
    updateCommentCollection,
    getQuestionTargetComments,
    handleCommentDraftChange,
    handleAddComment,
    toggleCommentSection,
    toggleCommentMenu,
    toggleReplyComposer,
    handleReplyDraftChange,
    handleAddReply,
    handleStartCommentEdit,
    handleSaveCommentEdit,
    handleDeleteComment,
    handleCommentUpvote,
    cancelCommentEdit,
    cancelReplyComposer,
    sanitizeTagName,
    normalizeTagName,
    isNumericOnlyTag,
    addTag,
    removeTag,
    handleQuestionSubmit,
    openQuestionDetail,
    handleOpenQuestion,
    handleListQuestionUpvote,
    handleToggleQuestionBookmark,
    handleOpenCloseModal,
    handleCloseQuestion,
    handleReopenQuestion,
    handleDeleteQuestion,
    handleUndeleteQuestion,
    handleBackToQuestions,
    handleApplyTagFilter,
    handleStartQuestionEdit,
    handleStartTagsEdit,
    addEditTag,
    removeEditTag,
    handleSaveQuestionEdit,
    handleAnswerSubmit,
    handleStartAnswerEdit,
    handleSaveAnswerEdit,
    handleQuestionVote,
    handleDeleteAnswer,
    handleUndeleteAnswer,
    handleAnswerVote,
    handleApproveAnswer,
    handleOfferBounty,
    handleAwardBounty,
    questionCommentData,
    sortedAnswers,
    formatQuestionTime,
    isActuallyEdited,
    getCloseReasonLabel,
    BOUNTY_REASONS,
    formatVerboseRelativeTime,
  };
}

export default useQuestionTabController;
