import { useCallback, useEffect, useMemo, useState } from 'react';
import { postService, tagService, teamService, voteService } from '../../services/api';
import { buildCommentData, EMPTY_COMMENT_DATA } from '../../components/CommentSection';
import { formatVerboseRelativeTime } from '../../utils/dateTime';
import useEntityIdInUrl from '../useEntityIdInUrl';
import useCommentSectionState from '../useCommentSectionState';
import useTagPreferences from '../useTagPreferences';
import useThreadedComments from '../useThreadedComments';
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
  const [showAnswerSection, setShowAnswerSection] = useState(false);
  const [answerBody, setAnswerBody] = useState('');
  const [answerError, setAnswerError] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [deletingAnswerId, setDeletingAnswerId] = useState(null);
  const [editingAnswerId, setEditingAnswerId] = useState(null);
  const [editAnswerBody, setEditAnswerBody] = useState('');
  const [editAnswerError, setEditAnswerError] = useState('');
  const [savingAnswerEdit, setSavingAnswerEdit] = useState(false);
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
  const [voteError, setVoteError] = useState('');
  const [approvalError, setApprovalError] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReason, setCloseReason] = useState('off-topic');
  const [closeError, setCloseError] = useState('');
  const [closingQuestion, setClosingQuestion] = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState(false);
  const [duplicateQuery, setDuplicateQuery] = useState('');
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [searchingDuplicate, setSearchingDuplicate] = useState(false);
  const [selectedDuplicate, setSelectedDuplicate] = useState(null);
  const [questionFilter, setQuestionFilter] = useState('newest');
  const [selectedTagFilter, setSelectedTagFilter] = useState('');
  const [questionPage, setQuestionPage] = useState(1);
  const [questionPageSize, setQuestionPageSize] = useState(DEFAULT_QUESTION_LIST_PAGE_SIZE);
  const [questionPagination, setQuestionPagination] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [mentionSearchOpen, setMentionSearchOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionError, setMentionError] = useState('');
  const [mentioningUserId, setMentioningUserId] = useState(null);
  const [removingMentionUserId, setRemovingMentionUserId] = useState(null);
  const [followingQuestion, setFollowingQuestion] = useState(false);
  const [showBountyModal, setShowBountyModal] = useState(false);
  const [selectedBountyReason, setSelectedBountyReason] = useState(BOUNTY_REASONS[0].title);
  const [offeringBounty, setOfferingBounty] = useState(false);
  const [awardingBountyAnswerId, setAwardingBountyAnswerId] = useState(null);
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
  }, [resetCommentSectionState]);

  const mentionedUserIdSet = useMemo(
    () => new Set((selectedQuestion?.mentions || []).map((item) => Number(item.user_id))),
    [selectedQuestion],
  );

  const mentionCandidates = useMemo(() => {
    const query = mentionQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return (teamMembers || [])
      .filter((member) => !mentionedUserIdSet.has(Number(member.id)))
      .filter((member) => {
        const name = String(member.name || '').toLowerCase();
        const email = String(member.email || '').toLowerCase();
        return name.includes(query) || email.includes(query);
      })
      .slice(0, 10);
  }, [teamMembers, mentionQuery, mentionedUserIdSet]);

  const loadTeamMembers = useCallback(async (force = false) => {
    if (!team?.id) {
      return;
    }

    if (!force && teamMembers.length > 0) {
      return;
    }

    try {
      setMentionLoading(true);
      setMentionError('');
      const data = await teamService.listTeamUsers(team.id);
      setTeamMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      setMentionError(err.response?.data?.error || 'Failed to load team users.');
    } finally {
      setMentionLoading(false);
    }
  }, [team?.id, teamMembers.length]);

  const handleToggleMentionSearch = async () => {
    const nextOpen = !mentionSearchOpen;
    setMentionSearchOpen(nextOpen);
    setMentionError('');

    if (nextOpen) {
      await loadTeamMembers(true);
    }
  };

  const handleMentionUser = async (targetUserId) => {
    if (!selectedQuestion || !targetUserId) {
      return;
    }

    try {
      setMentioningUserId(targetUserId);
      setMentionError('');
      const data = await postService.addQuestionMentions(selectedQuestion.id, [targetUserId]);
      setSelectedQuestion((prev) =>
        prev
          ? {
              ...prev,
              mentions: data.mentions || prev.mentions || [],
            }
          : prev
      );
      setMentionQuery('');
    } catch (err) {
      setMentionError(err.response?.data?.error || 'Failed to mention user.');
    } finally {
      setMentioningUserId(null);
    }
  };

  const handleRemoveMentionUser = async (targetUserId) => {
    if (!selectedQuestion || !targetUserId) {
      return;
    }

    try {
      setRemovingMentionUserId(targetUserId);
      setMentionError('');
      const data = await postService.removeQuestionMention(selectedQuestion.id, targetUserId);
      setSelectedQuestion((prev) =>
        prev
          ? {
              ...prev,
              mentions: data.mentions || [],
            }
          : prev
      );
    } catch (err) {
      setMentionError(err.response?.data?.error || 'Failed to remove mention.');
    } finally {
      setRemovingMentionUserId(null);
    }
  };

  const handleToggleFollowQuestion = async () => {
    if (!selectedQuestion) {
      return;
    }

    try {
      setFollowingQuestion(true);
      setListError('');

      const result = selectedQuestion.is_following
        ? await postService.unfollowQuestion(selectedQuestion.id)
        : await postService.followQuestion(selectedQuestion.id);

      setSelectedQuestion((prev) =>
        prev
          ? {
              ...prev,
              is_following: result.is_following,
              followers_count: result.followers_count,
            }
          : prev
      );
    } catch (err) {
      setListError(err.response?.data?.error || 'Failed to update follow status.');
    } finally {
      setFollowingQuestion(false);
    }
  };

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

  useEffect(() => {
    if (!showCloseModal || closeReason !== 'duplicate') {
      return;
    }

    const query = duplicateQuery.trim();
    if (!query) {
      setDuplicateMatches([]);
      setSearchingDuplicate(false);
      return;
    }

    const debounce = setTimeout(async () => {
      try {
        setSearchingDuplicate(true);
        const result = await postService.searchQuestions(team.id, query);
        const selectedQuestionId = selectedQuestion?.id;
        const filtered = (result || []).filter((item) => item.id !== selectedQuestionId);
        setDuplicateMatches(filtered);
      } catch {
        setDuplicateMatches([]);
      } finally {
        setSearchingDuplicate(false);
      }
    }, 250);

    return () => clearTimeout(debounce);
  }, [showCloseModal, closeReason, duplicateQuery, team.id, selectedQuestion]);

  const handleOpenCloseModal = () => {
    setCloseReason('off-topic');
    setCloseError('');
    setDuplicateQuery('');
    setDuplicateMatches([]);
    setSelectedDuplicate(null);
    setShowCloseModal(true);
  };

  const handleCloseQuestion = async () => {
    if (!selectedQuestion) {
      return;
    }

    if (selectedQuestion.closed_reason) {
      setCloseError('Question is already closed.');
      return;
    }

    if (closeReason === 'duplicate' && !selectedDuplicate) {
      setCloseError('Select a duplicate question first.');
      return;
    }

    try {
      setClosingQuestion(true);
      setCloseError('');

      const payload = {
        reason: closeReason,
      };
      if (closeReason === 'duplicate' && selectedDuplicate) {
        payload.duplicate_post_id = selectedDuplicate.id;
      }

      const result = await postService.closeQuestion(selectedQuestion.id, payload);

      setSelectedQuestion((prev) =>
        prev
          ? {
              ...prev,
              is_closed: true,
              closed_reason: result.closed_reason,
              closed_at: result.closed_at,
              closed_by: result.closed_by,
              closed_by_username: result.closed_by_username,
              duplicate_post_id: result.duplicate_post_id,
              duplicate_post_title: result.duplicate_post_title,
              parent: result.duplicate_post_id || null,
            }
          : prev
      );

      setQuestions((prev) =>
        prev.map((item) =>
          item.id === selectedQuestion.id
            ? {
                ...item,
                is_closed: true,
                closed_reason: result.closed_reason,
                closed_at: result.closed_at,
                closed_by: result.closed_by,
                closed_by_username: result.closed_by_username,
                duplicate_post_id: result.duplicate_post_id,
                duplicate_post_title: result.duplicate_post_title,
                parent: result.duplicate_post_id || null,
              }
            : item
        )
      );

      setShowAnswerSection(false);
      setShowCloseModal(false);
    } catch (err) {
      setCloseError(err.response?.data?.error || 'Failed to close question.');
    } finally {
      setClosingQuestion(false);
    }
  };

  const handleReopenQuestion = async () => {
    if (!selectedQuestion) {
      return;
    }

    try {
      setListError('');
      const result = await postService.reopenQuestion(selectedQuestion.id);

      setSelectedQuestion((prev) =>
        prev
          ? {
              ...prev,
              is_closed: false,
              closed_reason: result.closed_reason,
              closed_at: result.closed_at,
              closed_by: result.closed_by,
              closed_by_username: result.closed_by_username,
              duplicate_post_id: result.duplicate_post_id,
              duplicate_post_title: result.duplicate_post_title,
              parent: null,
            }
          : prev
      );

      setQuestions((prev) =>
        prev.map((item) =>
          item.id === selectedQuestion.id
            ? {
                ...item,
                is_closed: false,
                closed_reason: result.closed_reason,
                closed_at: result.closed_at,
                closed_by: result.closed_by,
                closed_by_username: result.closed_by_username,
                duplicate_post_id: result.duplicate_post_id,
                duplicate_post_title: result.duplicate_post_title,
                parent: null,
              }
            : item
        )
      );
    } catch (err) {
      setListError(err.response?.data?.error || 'Failed to reopen question.');
    }
  };

  const handleDeleteQuestion = async () => {
    if (!selectedQuestion || selectedQuestion.delete_flag) {
      return;
    }

    try {
      setDeletingQuestion(true);
      setListError('');
      await postService.deleteQuestion(selectedQuestion.id);

      setSelectedQuestion((prev) => (prev ? { ...prev, delete_flag: true } : prev));
      setQuestions((prev) => prev.filter((item) => item.id !== selectedQuestion.id));
      setShowAnswerSection(false);
    } catch (err) {
      setListError(err.response?.data?.error || 'Failed to delete question.');
    } finally {
      setDeletingQuestion(false);
    }
  };

  const handleUndeleteQuestion = async () => {
    if (!selectedQuestion || !selectedQuestion.delete_flag) {
      return;
    }

    try {
      setDeletingQuestion(true);
      setListError('');
      await postService.undeleteQuestion(selectedQuestion.id);

      setSelectedQuestion((prev) => (prev ? { ...prev, delete_flag: false } : prev));
      await loadQuestions();
    } catch (err) {
      setListError(err.response?.data?.error || 'Failed to undelete question.');
    } finally {
      setDeletingQuestion(false);
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

  const handleAnswerSubmit = async (e) => {
    e.preventDefault();
    if (!selectedQuestion) {
      return;
    }

    if (selectedQuestion.delete_flag) {
      setAnswerError('This question is deleted and not accepting new answers.');
      setShowAnswerSection(false);
      return;
    }

    if (selectedQuestion.closed_reason) {
      setAnswerError('This question is closed and not accepting new answers.');
      setShowAnswerSection(false);
      return;
    }

    setAnswerError('');
    setSubmittingAnswer(true);

    try {
      const created = await postService.createAnswer(selectedQuestion.id, { body: answerBody });
      setSelectedQuestion((prev) => {
        if (!prev) {
          return prev;
        }

        const existingAnswers = prev.answers || [];
        return {
          ...prev,
          answers: [...existingAnswers, created],
        };
      });
      setAnswerBody('');
      setShowAnswerSection(false);
    } catch (err) {
      setAnswerError(err.response?.data?.error || 'Failed to post answer. Please try again.');
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handleStartAnswerEdit = (answer) => {
    setEditingAnswerId(answer.id);
    setEditAnswerBody(answer.body || '');
    setEditAnswerError('');
  };

  const handleSaveAnswerEdit = async () => {
    if (!editingAnswerId) {
      return;
    }

    setEditAnswerError('');
    setSavingAnswerEdit(true);

    try {
      const updated = await postService.updateAnswer(editingAnswerId, {
        body: editAnswerBody,
      });

      setSelectedQuestion((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          answers: (prev.answers || []).map((answer) =>
            answer.id === updated.id ? { ...answer, ...updated } : answer
          ),
        };
      });
      setEditingAnswerId(null);
      setEditAnswerBody('');
    } catch (err) {
      setEditAnswerError(err.response?.data?.error || 'Failed to update answer.');
    } finally {
      setSavingAnswerEdit(false);
    }
  };

  const handleQuestionVote = async (voteValue) => {
    if (!selectedQuestion) {
      return;
    }

    const currentVote = Number(selectedQuestion.current_user_vote || 0);

    try {
      setVoteError('');
      const result =
        currentVote === voteValue
          ? await voteService.removeVote({ postId: selectedQuestion.id })
          : await voteService.submitVote({ postId: selectedQuestion.id, vote: voteValue });

      setSelectedQuestion((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          vote_count: result.vote_count,
          current_user_vote: result.vote,
        };
      });

      setQuestions((prev) =>
        prev.map((question) =>
          question.id === selectedQuestion.id
            ? {
                ...question,
                vote_count: result.vote_count,
                current_user_vote: result.vote,
              }
            : question
        )
      );
    } catch (err) {
      setVoteError(err.response?.data?.error || 'Failed to vote on question.');
    }
  };

  const handleDeleteAnswer = async (answerId) => {
    if (!selectedQuestion) {
      return;
    }

    try {
      setDeletingAnswerId(answerId);
      setVoteError('');
      await postService.deleteAnswer(answerId);

      setSelectedQuestion((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          approved_answer: prev.approved_answer === answerId ? null : prev.approved_answer,
          answers: (prev.answers || []).map((item) =>
            item.id === answerId
              ? {
                  ...item,
                  delete_flag: true,
                }
              : item
          ),
        };
      });
    } catch (err) {
      setVoteError(err.response?.data?.error || 'Failed to delete answer.');
    } finally {
      setDeletingAnswerId(null);
    }
  };

  const handleUndeleteAnswer = async (answerId) => {
    if (!selectedQuestion) {
      return;
    }

    try {
      setDeletingAnswerId(answerId);
      setVoteError('');
      await postService.undeleteAnswer(answerId);

      setSelectedQuestion((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          answers: (prev.answers || []).map((item) =>
            item.id === answerId
              ? {
                  ...item,
                  delete_flag: false,
                }
              : item
          ),
        };
      });
    } catch (err) {
      setVoteError(err.response?.data?.error || 'Failed to undelete answer.');
    } finally {
      setDeletingAnswerId(null);
    }
  };

  const handleAnswerVote = async (answerId, voteValue) => {
    if (selectedQuestion?.delete_flag) {
      setVoteError('Cannot vote on answers for a deleted question.');
      return;
    }

    const answer = (selectedQuestion?.answers || []).find((item) => item.id === answerId);
    if (!answer) {
      return;
    }

    if (answer.delete_flag) {
      setVoteError('Cannot vote on a deleted answer.');
      return;
    }

    const currentVote = Number(answer.current_user_vote || 0);

    try {
      setVoteError('');
      const result =
        currentVote === voteValue
          ? await voteService.removeVote({ postId: answerId })
          : await voteService.submitVote({ postId: answerId, vote: voteValue });

      setSelectedQuestion((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          answers: (prev.answers || []).map((item) =>
            item.id === answerId
              ? {
                  ...item,
                  vote_count: result.vote_count,
                  current_user_vote: result.vote,
                }
              : item
          ),
        };
      });
    } catch (err) {
      setVoteError(err.response?.data?.error || 'Failed to vote on answer.');
    }
  };

  const handleApproveAnswer = async (answerId) => {
    if (!selectedQuestion || !selectedQuestion.can_approve_answers) {
      return;
    }

    if (selectedQuestion.delete_flag) {
      setApprovalError('Cannot approve answers for a deleted question.');
      return;
    }

    const targetAnswer = (selectedQuestion.answers || []).find((item) => item.id === answerId);
    if (!targetAnswer || targetAnswer.delete_flag) {
      setApprovalError('Cannot approve a deleted answer.');
      return;
    }

    try {
      setApprovalError('');
      const nextApprovedAnswerId = selectedQuestion.approved_answer === answerId ? null : answerId;
      const result = await postService.approveAnswer(selectedQuestion.id, nextApprovedAnswerId);
      setSelectedQuestion((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          approved_answer: result.approved_answer,
        };
      });
      setQuestions((prev) =>
        prev.map((question) =>
          question.id === selectedQuestion.id
            ? { ...question, approved_answer: result.approved_answer }
            : question
        )
      );
    } catch (err) {
      setApprovalError(err.response?.data?.error || 'Failed to approve answer.');
    }
  };

  const handleOfferBounty = async () => {
    if (!selectedQuestion || !selectedQuestion.can_offer_bounty) {
      return;
    }

    try {
      setOfferingBounty(true);
      setApprovalError('');
      const result = await postService.offerQuestionBounty(selectedQuestion.id, selectedBountyReason);

      setSelectedQuestion((prev) =>
        prev
          ? {
              ...prev,
              bounty_amount: result.bounty_amount || 0,
              bounty: result.bounty || null,
              can_offer_bounty: false,
              can_award_bounty: true,
            }
          : prev
      );
      setQuestions((prev) =>
        prev.map((question) =>
          question.id === selectedQuestion.id
            ? {
                ...question,
                bounty_amount: result.bounty_amount || 0,
              }
            : question
        )
      );
      setShowBountyModal(false);
    } catch (err) {
      setApprovalError(err.response?.data?.error || 'Failed to offer bounty.');
    } finally {
      setOfferingBounty(false);
    }
  };

  const handleAwardBounty = async (answerId) => {
    if (!selectedQuestion || !selectedQuestion.can_award_bounty || (selectedQuestion.bounty_amount || 0) <= 0) {
      return;
    }

    try {
      setAwardingBountyAnswerId(answerId);
      setApprovalError('');
      const result = await postService.awardQuestionBounty(selectedQuestion.id, answerId);

      setSelectedQuestion((prev) => {
        if (!prev) {
          return prev;
        }

        const nextCanOffer = !prev.delete_flag && !prev.closed_reason;
        return {
          ...prev,
          bounty_amount: result.bounty_amount || 0,
          bounty: result.bounty || null,
          can_award_bounty: false,
          can_offer_bounty: nextCanOffer,
        };
      });

      setQuestions((prev) =>
        prev.map((question) =>
          question.id === selectedQuestion.id
            ? {
                ...question,
                bounty_amount: result.bounty_amount || 0,
              }
            : question
        )
      );
    } catch (err) {
      setApprovalError(err.response?.data?.error || 'Failed to award bounty.');
    } finally {
      setAwardingBountyAnswerId(null);
    }
  };

  const questionCommentData = selectedQuestion
    ? buildCommentData(selectedQuestion.comments)
    : EMPTY_COMMENT_DATA;
  const sortedAnswers = selectedQuestion?.answers
    ? (() => {
        const approvedAnswerId = selectedQuestion.approved_answer;
        if (!approvedAnswerId) {
          return selectedQuestion.answers;
        }

        const approved = selectedQuestion.answers.find((answer) => answer.id === approvedAnswerId);
        if (!approved) {
          return selectedQuestion.answers;
        }

        const remaining = selectedQuestion.answers.filter((answer) => answer.id !== approvedAnswerId);
        return [approved, ...remaining];
      })()
    : [];


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
