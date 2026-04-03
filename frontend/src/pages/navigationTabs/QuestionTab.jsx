import { useCallback, useEffect, useMemo, useState } from 'react';
import { postService, tagService, teamService, voteService } from '../../services/api';
import CommentSection, {
  buildCommentData,
  EMPTY_COMMENT_DATA,
  buildCommentKey,
  buildCommentItemKey,
} from '../../components/CommentSection';
import VotePanel from '../../components/VotePanel';
import ListingCard from '../../components/ListingCard';
import TagPreferencesPanel from '../../components/TagPreferencesPanel';
import PostComposerModal from '../../components/PostComposerModal';
import { formatRelativeTimestamp, formatVerboseRelativeTime } from '../../utils/dateTime';
import useEntityIdInUrl from '../../hooks/useEntityIdInUrl';
import useCommentSectionState from '../../hooks/useCommentSectionState';
import useTagPreferences from '../../hooks/useTagPreferences';
import useThreadedComments from '../../hooks/useThreadedComments';

const formatQuestionTime = (timestamp) => formatRelativeTimestamp(timestamp);

const isActuallyEdited = (createdAt, modifiedAt) => {
  if (!createdAt || !modifiedAt) {
    return false;
  }

  const created = new Date(createdAt).getTime();
  const modified = new Date(modifiedAt).getTime();

  if (Number.isNaN(created) || Number.isNaN(modified)) {
    return false;
  }

  return Math.abs(modified - created) > 1000;
};

const getCloseReasonLabel = (reason) => {
  if (reason === 'duplicate') {
    return 'Duplicate';
  }
  if (reason === 'off-topic') {
    return 'Off-topic';
  }
  return 'Closed';
};

const BOUNTY_REASONS = [
  {
    title: 'Authoritative reference needed',
    description: 'Looking for an answer drawing from credible and/or official sources.',
  },
  {
    title: 'Canonical answer required',
    description: 'The question is widely applicable to a large audience. A detailed canonical answer is required to address all the concerns.',
  },
  {
    title: 'Current answers are outdated',
    description: 'The current answer(s) are out-of-date and require revision given recent changes.',
  },
  {
    title: 'Draw attention',
    description: 'This question has not received enough attention.',
  },
  {
    title: 'Improve details',
    description: 'The current answers do not contain enough detail.',
  },
  {
    title: 'Reward existing answer',
    description: 'One or more of the answers is exemplary and worthy of an additional bounty.',
  },
];

function QuestionTab({ team, embeddedMode = false, onOpenUserProfile }) {
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
  } = useTagPreferences({ teamId: team?.id, clearPreferencesOnLoadError: false });

  const loadQuestions = async () => {
    setLoadingQuestions(true);
    setListError('');

    try {
      const data = await postService.listQuestions(team.id);
      setQuestions(Array.isArray(data) ? data : []);
    } catch (err) {
      setListError(err.response?.data?.error || 'Failed to load questions.');
    } finally {
      setLoadingQuestions(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, [team.id]);

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
      } catch (_err) {
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
      } catch (_err) {
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
      await loadQuestions();
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

  return (
    <>
      {!embeddedMode ? (
        /* Question tab header */
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {selectedQuestion ? (
              <button
                type="button"
                onClick={handleBackToQuestions}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/20"
              >
                Back
              </button>
            ) : null}
            <h2 className="text-2xl font-semibold text-white">Questions</h2>
          </div>

          {!selectedQuestion ? (
            <button
              onClick={() => {
                setQuestionError('');
                setTagError('');
                setQuestionTags([]);
                setTagInput('');
                setTagSuggestions([]);
                setShowAskModal(true);
              }}
              className="rounded-full bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Ask a question
            </button>
          ) : null}
        </div>

        {!selectedQuestion ? (
          <>
            <p className="text-slate-300">Ask and manage team questions for this workspace.</p>

            {/* Question filters */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {[
                { key: 'newest', label: 'Newest' },
                { key: 'active', label: 'Active' },
                { key: 'unanswered', label: 'Unanswered' },
                { key: 'bounty', label: 'Bountied' },
              ].map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setQuestionFilter(filter.key)}
                  className={`rounded-sm border px-3 py-0.5 text-xs font-medium transition ${
                    questionFilter === filter.key
                      ? 'border-cyan-300/0 bg-cyan-300/20 text-cyan-100'
                      : 'border-white/0 bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  {filter.label}
                </button>
              ))}

              {selectedTagFilter ? (
                <>
                  <span className="rounded-full border border-cyan-300/0 bg-cyan-300/15 px-3 py-0.5 text-xs text-cyan-100">
                    Tag: {selectedTagFilter}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedTagFilter('')}
                    className="rounded-full border border-white/0 bg-white/10 px-3 py-0.5 text-xs text-slate-300 transition hover:bg-white/20"
                  >
                    Clear tag filter
                  </button>
                </>
              ) : null}
            </div>

            {listError ? (
              <p className="mt-4 rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
                {listError}
              </p>
            ) : null}

            {loadingQuestions ? <p className="mt-6 text-slate-300">Loading questions...</p> : null}

            {!loadingQuestions && questions.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-10 text-center text-slate-400">
                No questions posted yet.
              </div>
            ) : null}

            {!loadingQuestions && questions.length > 0 && visibleQuestions.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-10 text-center text-slate-400">
                No questions match this filter.
              </div>
            ) : null}

            <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div>
              {/* Question listing */}
              {!loadingQuestions && visibleQuestions.length > 0 ? (
              <ul className="space-y-2">
                {visibleQuestions.map((question) => (
                  (() => {
                    const questionTags = question.tags || [];
                    const hasWatchedTag = questionTags.some((tag) => {
                      const tagId = Number(tag.id);
                      const tagName = String(tag.name || '').toLowerCase();
                      return watchedTagIdSet.has(tagId) || watchedTagNameSet.has(tagName);
                    });
                    const hasIgnoredTag = questionTags.some((tag) => {
                      const tagId = Number(tag.id);
                      const tagName = String(tag.name || '').toLowerCase();
                      return ignoredTagIdSet.has(tagId) || ignoredTagNameSet.has(tagName);
                    });

                    return (
                  <li key={question.id}>
                    <ListingCard
                      highlighted={hasWatchedTag}
                      score={question.vote_count}
                      currentVote={question.current_user_vote}
                      onUpvote={() => handleListQuestionUpvote(question.id)}
                      upvoteAriaLabel="Upvote question"
                      isBookmarked={Boolean(question.is_bookmarked)}
                      onToggleBookmark={() => handleToggleQuestionBookmark(question.id)}
                      bookmarkAriaLabel="Bookmark question"
                      neutralButtonClassName="border-white/10 bg-white/10 text-slate-200 hover:bg-white/20"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                            question.approved_answer
                            ? 'border-emerald-300/0 bg-emerald-400/20 text-emerald-300'
                            : 'border-white/0 bg-white/10 text-slate-300'
                          }`}
                          >
                          {question.answer_count || 0} answers
                        </span>
                        <span className="rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                          {question.views_count || 0} views
                        </span>
                          {question.closed_reason ? (
                              <span className="rounded-full border border-rose-300/0 bg-rose-400/20 px-2.5 py-0.5 text-[11px] font-medium text-rose-200">
                                {getCloseReasonLabel(question.closed_reason)}
                              </span>
                            ) : null}
                          {(question.bounty_amount || 0) > 0 ? (
                          <span className="rounded-full border border-amber-300/0 bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-medium text-amber-100">
                            +{question.bounty_amount} bounty
                          </span>
                            ) : null}
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <button
                          type="button"
                          onClick={() => handleOpenQuestion(question.id)}
                          className={`text-left font-medium hover:underline transition ${
                            question.delete_flag
                              ? 'text-rose-300 hover:text-rose-200'
                              : hasIgnoredTag
                                ? 'text-slate-400 hover:text-slate-300'
                                : 'text-slate-100 hover:text-cyan-200'
                          }`}
                        >
                          {question.title}
                        </button>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <p
                          className={`mt-1 text-sm ${question.delete_flag ? 'text-rose-300/80' : hasIgnoredTag ? 'text-slate-500' : 'text-slate-300'}`}
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {question.body}
                        </p>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-4">
                        <div className="min-w-0 flex flex-wrap gap-2">
                          {question.tags && question.tags.length > 0
                            ? question.tags.map((tag) => (
                                <button
                                  type="button"
                                  key={tag.id || tag.name}
                                  onClick={() => handleApplyTagFilter(tag.name || '')}
                                  className={`rounded-sm border px-2.5 py-0.5 text-[11px] font-medium ${
                                    question.delete_flag
                                      ? 'border-rose-300/30 bg-rose-400/10 text-rose-200'
                                      : hasIgnoredTag
                                      ? 'border-white/10 bg-white/10 text-slate-400'
                                      : 'border-cyan-300/0 bg-cyan-300/10 text-cyan-400'
                                  }`}
                                >
                                  {tag.name}
                                </button>
                              ))
                            : null}
                        </div>
                        <p className="shrink-0 text-right text-xs text-slate-400">
                          <span>
                            <button
                              type="button"
                              onClick={() => onOpenUserProfile?.(question.user_id)}
                              className="font-medium text-slate-300 transition hover:text-cyan-200 hover:underline"
                            >
                              {question.user_name}
                            </button>
                            {question.user_is_admin ? (
                              <span className="ml-1 rounded-full border border-amber-300/30 bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-200">
                                Admin
                              </span>
                            ) : null}{' '}
                            asked {formatQuestionTime(question.created_at)}
                          </span>
                        </p>
                      </div>
                    </ListingCard>
                  </li>
                    );
                  })()
                ))}
              </ul>
            ) : null}
              </div>

              {/* Right Sidebar with tag preferences */}
              <aside className="space-y-3">
                <TagPreferencesPanel
                  watchingTags={watchingTags}
                  ignoredTags={ignoredTags}
                  watchTagInput={watchTagInput}
                  onWatchTagInputChange={setWatchTagInput}
                  watchSuggestions={watchSuggestions}
                  onAddWatchTag={(tag) => {
                    handleSetTagPreference({ tagId: tag.id, field: 'is_watching', value: true });
                    setWatchTagInput('');
                  }}
                  ignoreTagInput={ignoreTagInput}
                  onIgnoreTagInputChange={setIgnoreTagInput}
                  ignoreSuggestions={ignoreSuggestions}
                  onAddIgnoreTag={(tag) => {
                    handleSetTagPreference({ tagId: tag.id, field: 'is_ignored', value: true });
                    setIgnoreTagInput('');
                  }}
                  onTagSelect={handleApplyTagFilter}
                  onSetTagPreference={handleSetTagPreference}
                  updatingTagPreferenceKey={updatingTagPreferenceKey}
                  loading={loadingTagPreferences}
                  error={tagPreferenceError}
                />

                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <h3 className="text-xs font-semibold tracking-[0.12em] text-slate-300 uppercase">Related Tags</h3>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {questionTagCounts.length === 0 ? (
                      <p className="text-xs text-slate-400">No tags found in questions.</p>
                    ) : (
                      questionTagCounts.map((tag) => (
                        <button
                          key={`question-tag-count-${tag.name}`}
                          type="button"
                          onClick={() => handleApplyTagFilter(tag.name)}
                          className="rounded-sm border border-cyan-300/0 bg-cyan-300/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-400"
                        >
                          {tag.name} ({tag.count})
                        </button>
                      ))
                    )}
                  </div>
                </div>

              </aside>
            </div>
          </>
        ) : null}
      </div>
      ) : null}

      {/* Ask question modal */ }
      <PostComposerModal
        open={showAskModal && !embeddedMode}
        modalTitle="Ask a question"
        onSubmit={handleQuestionSubmit}
        titleValue={questionTitle}
        onTitleChange={setQuestionTitle}
        titlePlaceholder="What issue are you facing?"
        bodyValue={questionBody}
        onBodyChange={setQuestionBody}
        bodyPlaceholder="Describe your question with all relevant details..."
        bodyMinHeightClassName="min-h-[180px]"
        tags={questionTags}
        onRemoveTag={removeTag}
        tagInput={tagInput}
        onTagInputChange={(value) => {
          setTagError('');
          setTagInput(sanitizeTagName(value));
        }}
        onTagKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
            e.preventDefault();
            addTag(tagInput);
          }
        }}
        tagSuggestions={tagSuggestions}
        searchingTags={searchingTags}
        onAddTag={addTag}
        tagError={tagError}
        formError={questionError}
        isSubmitting={submittingQuestion}
        submitLabel="Post Question"
        submittingLabel="Posting..."
        cancelLabel="Cancel"
        onClose={() => {
          setShowAskModal(false);
          setQuestionError('');
          setTagError('');
          setQuestionTags([]);
          setTagInput('');
          setTagSuggestions([]);
        }}
        panelClassName="w-full max-w-2xl rounded-[2rem] border border-white/5 bg-[#111821] p-6 shadow-2xl shadow-black/50 sm:p-6"
        fieldBorderClassName="border-white/10"
        submitButtonClassName="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        closeButtonClassName="rounded-full border border-white/0 bg-white/10 px-5 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/20"
      />

      {/* Close question modal */ }
      {showCloseModal && selectedQuestion ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#111821] p-6 shadow-2xl shadow-black/50 sm:p-8">
            <h3 className="text-2xl font-semibold text-white">Close question</h3>
            <p className="mt-1 text-sm text-slate-300">Choose a reason. Closed questions do not accept new answers.</p>

            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="radio"
                  name="closeReason"
                  value="duplicate"
                  checked={closeReason === 'duplicate'}
                  onChange={() => {
                    setCloseReason('duplicate');
                    setCloseError('');
                  }}
                  className="h-4 w-4"
                />
                Duplicate
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="radio"
                  name="closeReason"
                  value="off-topic"
                  checked={closeReason === 'off-topic'}
                  onChange={() => {
                    setCloseReason('off-topic');
                    setCloseError('');
                  }}
                  className="h-4 w-4"
                />
                Off-topic
              </label>
            </div>

            {closeReason === 'duplicate' ? (
              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-slate-200">Search duplicate question by title</label>
                <input
                  type="text"
                  value={duplicateQuery}
                  onChange={(e) => {
                    setDuplicateQuery(e.target.value);
                    setSelectedDuplicate(null);
                    setCloseError('');
                  }}
                  className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                  placeholder="Search by question title"
                />

                {searchingDuplicate ? <p className="mt-2 text-xs text-slate-400">Searching questions...</p> : null}

                {!searchingDuplicate && duplicateQuery.trim() && duplicateMatches.length > 0 ? (
                  <ul className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-2">
                    {duplicateMatches.map((match) => (
                      <li key={match.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedDuplicate(match)}
                          className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                            selectedDuplicate?.id === match.id
                              ? 'bg-cyan-400/20 text-cyan-100'
                              : 'text-slate-200 hover:bg-white/10'
                          }`}
                        >
                          <span className={`block font-medium ${match.delete_flag ? 'text-rose-300' : ''}`}>
                            {match.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-400">
                            by{' '}
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenUserProfile?.(match.user_id || match.user);
                              }}
                              className="font-medium text-slate-300 transition hover:text-cyan-200 hover:underline"
                            >
                              {match.user_name}
                            </button>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {!searchingDuplicate && duplicateQuery.trim() && duplicateMatches.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">No matching questions found.</p>
                ) : null}

                {selectedDuplicate ? (
                  <p className="mt-2 text-xs text-cyan-200">Selected duplicate: #{selectedDuplicate.id}</p>
                ) : null}
              </div>
            ) : null}

            {closeError ? (
              <p className="mt-4 rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
                {closeError}
              </p>
            ) : null}

            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleCloseQuestion}
                disabled={closingQuestion}
                className="rounded-full bg-cyan-500 px-5 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {closingQuestion ? 'Closing...' : 'Close question'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCloseModal(false);
                  setCloseError('');
                  setDuplicateQuery('');
                  setDuplicateMatches([]);
                  setSelectedDuplicate(null);
                }}
                className="rounded-full border border-white/0 bg-white/10 px-5 py-1.5 text-sm font-medium text-slate-200 transition hover:bg-white/20"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* bounty offering modal */}
      {showBountyModal && selectedQuestion ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#111821] p-6 shadow-2xl shadow-black/50 sm:p-8">
            <h3 className="text-2xl font-semibold text-white">Offer bounty</h3>
            <p className="mt-1 text-sm text-slate-300">Choose one reason for offering +50 bounty on this question.</p>

            <div className="mt-4 space-y-2">
              {BOUNTY_REASONS.map((item) => (
                <label
                  key={item.title}
                  className={`block cursor-pointer rounded-2xl border px-4 py-3 transition ${
                    selectedBountyReason === item.title
                      ? 'border-amber-300/40 bg-amber-500/10'
                      : 'border-white/10 bg-black/20 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="bountyReason"
                      value={item.title}
                      checked={selectedBountyReason === item.title}
                      onChange={() => setSelectedBountyReason(item.title)}
                      className="mt-1 h-4 w-4"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-100">{item.title}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{item.description}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleOfferBounty}
                disabled={offeringBounty}
                className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {offeringBounty ? 'Offering...' : 'Offer +50 bounty'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBountyModal(false);
                  setOfferingBounty(false);
                }}
                className="rounded-full border border-white/0 bg-white/10 px-5 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/20"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Question details view */ }
      {selectedQuestion ? (
        <div className="mt-6 w-full rounded-3xl border border-white/10 bg-[#111821] p-6 shadow-2xl shadow-black/35 sm:p-8">
            <div className="mb-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-2xl font-semibold text-white">{selectedQuestion.title}</h3>
              </div>

              <div className="mt-2 flex items-start gap-3">
                <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                  <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1">
                    Asked: {formatVerboseRelativeTime(selectedQuestion.created_at)}
                  </span>
                  <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1">
                    Modified: {formatVerboseRelativeTime(selectedQuestion.modified_at)}
                  </span>
                  <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1">
                    {selectedQuestion.views_count || 0} views
                  </span>
                </div>
              </div>
              <div className="mt-3 border-t border-white/15" />
            </div>

            {/* Question editing view */ }
            {isEditingQuestion ? (
              <div className="space-y-2">
                {!isEditingTagsOnly ? (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-200">Title</label>
                      <input
                        type="text"
                        value={editQuestionTitle}
                        onChange={(e) => setEditQuestionTitle(e.target.value)}
                        className="w-full rounded-full border border-white/15 bg-black/20 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-200">Body</label>
                      <textarea
                        value={editQuestionBody}
                        onChange={(e) => setEditQuestionBody(e.target.value)}
                        className="min-h-[180px] w-full rounded-3xl border border-white/15 bg-black/20 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                        required
                      />
                    </div>
                  </>
                ) : null}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-200">
                    Tags <span className="text-slate-400">(max 5)</span>
                  </label>

                  <div className="rounded-2xl border border-white/15 bg-black/20 px-3 py-2">
                    <div className="mb-2 flex flex-wrap gap-2">
                      {editQuestionTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-2 rounded-sm border border-cyan-300/0 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-400"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeEditTag(tag)}
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
                        value={editTagInput}
                        onChange={(e) => {
                          setEditTagError('');
                          setEditTagInput(sanitizeTagName(e.target.value));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                            e.preventDefault();
                            addEditTag(editTagInput);
                          }
                        }}
                        className="w-full rounded-full border border-white/15 bg-black/25 px-4 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                        placeholder="Type a tag and press Space"
                      />

                      {(editTagSuggestions.length > 0 || searchingEditTags) && editTagInput.trim() ? (
                        <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-white/15 bg-[#0f141c] shadow-lg shadow-black/40">
                          {searchingEditTags ? (
                            <p className="px-3 py-2 text-xs text-slate-400">Searching tags...</p>
                          ) : (
                            <ul className="max-h-48 overflow-y-auto py-1">
                              {editTagSuggestions.map((tag) => (
                                <li key={tag.id}>
                                  <button
                                    type="button"
                                    onClick={() => addEditTag(tag.name)}
                                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10"
                                  >
                                    <span>{tag.name}</span>
                                    <span className="text-xs text-slate-400">{(Number(tag.question_count || 0) + Number(tag.article_count || 0))} posts</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {editTagError ? (
                  <p className="rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
                    {editTagError}
                  </p>
                ) : null}

                {editQuestionError ? (
                  <p className="rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
                    {editQuestionError}
                  </p>
                ) : null}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveQuestionEdit}
                    disabled={savingQuestionEdit}
                    className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingQuestionEdit ? 'Saving...' : isEditingTagsOnly ? 'Save tags' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingQuestion(false);
                      setIsEditingTagsOnly(false);
                      setEditQuestionError('');
                    }}
                    className="rounded-full border border-white/0 bg-white/10 px-4 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/20"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
              {/* Question closing, deleted banners */}
              {selectedQuestion.closed_reason ? (
                <div className="mb-3 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  <p className="font-medium">This question is closed as {getCloseReasonLabel(selectedQuestion.closed_reason)} and is not accepting new answers.</p>
                  {selectedQuestion.closed_reason === 'duplicate' && selectedQuestion.duplicate_post_id ? (
                    <p className="mt-1 text-xs text-rose-200">
                      Duplicate of question{': '}
                      <button
                        type="button"
                        onClick={() => handleOpenQuestion(selectedQuestion.duplicate_post_id)}
                        className="text-rose-100 underline decoration-rose-300/70 underline-offset-2 transition hover:text-white"
                      >{selectedQuestion.duplicate_post_title ? `${selectedQuestion.duplicate_post_title}` : ''}
                      </button>
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-rose-200">
                    Closed {selectedQuestion.closed_at ? formatQuestionTime(selectedQuestion.closed_at) : 'recently'}
                    {selectedQuestion.closed_by_username ? (
                      <>
                        {' '}by{' '}
                        <button
                          type="button"
                          onClick={() => onOpenUserProfile?.(selectedQuestion.closed_by)}
                          className="font-medium text-rose-100 underline decoration-rose-300/70 underline-offset-2 transition hover:text-white"
                        >
                          {selectedQuestion.closed_by_username}
                        </button>
                      </>
                    ) : null}
                  </p>
                </div>
              ) : null}

              {selectedQuestion.delete_flag ? (
                <div className="mb-3 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  <p className="font-medium">This question is deleted.</p>
                </div>
              ) : null}

              {(selectedQuestion.bounty_amount || 0) > 0 && selectedQuestion.bounty?.status === 'offered' ? (
                <div className="mb-3 rounded-2xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  <p className="font-medium">This question has +{selectedQuestion.bounty_amount} bounty.</p>
                  <p className="mt-1 text-xs text-amber-200">Reason: {selectedQuestion.bounty?.reason || '-'}</p>
                </div>
              ) : null}

              {/* Question voting component */ }
                <div className="flex items-start gap-2">
                  <VotePanel
                    score={selectedQuestion.vote_count}
                    currentVote={selectedQuestion.current_user_vote}
                    onUpvote={() => handleQuestionVote(1)}
                    onDownvote={() => handleQuestionVote(-1)}
                    upvoteAriaLabel="Upvote question"
                    downvoteAriaLabel="Downvote question"
                    showBookmark
                    isBookmarked={Boolean(selectedQuestion.is_bookmarked)}
                    onToggleBookmark={() => handleToggleQuestionBookmark(selectedQuestion.id)}
                    bookmarkAriaLabel="Bookmark question"
                    showBookmarkCount
                    bookmarkCount={selectedQuestion.bookmarks_count}
                  />
                  
                  {/* Question body, tags, username */ }
                  <div className="min-w-0 flex-1">
                    <div className="rounded-2xl border border-white/0 bg-white/5 px-3 py-2 text-sm text-slate-200">
                      <div className="max-h-[45vh] overflow-y-auto whitespace-pre-wrap">{selectedQuestion.body}</div>
                      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          {(selectedQuestion.tags || []).map((tag) => (
                            <button
                              type="button"
                              key={tag.id || tag.name}
                              onClick={() => handleApplyTagFilter(tag.name || '')}
                              className="rounded-sm border border-cyan-300/0 bg-cyan-300/10 px-3 py-0.5 text-xs font-medium text-cyan-400"
                            >
                              {tag.name}
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={handleStartTagsEdit}
                            className="text-xs font-medium text-white/50 transition hover:text-cyan-200"
                          >
                            Edit tags
                          </button>
                        </div>

                        <div className="relative z-20 ml-auto">
                          <button
                            type="button"
                            onClick={handleToggleMentionSearch}
                            className="rounded-full border border-white/0 bg-white/10 px-3 py-1 text-xs font-medium text-slate-100 transition hover:bg-white/20"
                          >
                            Ask people
                          </button>

                          {mentionSearchOpen ? (
                            <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-white/15 bg-[#0f141c] p-3 shadow-2xl shadow-black/50">
                              <input
                                type="text"
                                value={mentionQuery}
                                onChange={(event) => setMentionQuery(event.target.value)}
                                className="w-full rounded-full border border-white/15 bg-black/20 px-3 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                                placeholder="Search users by name or email"
                              />

                              {mentionLoading ? <p className="mt-2 text-xs text-slate-400">Loading users...</p> : null}

                              {!mentionLoading && !mentionQuery.trim() ? (
                                <p className="mt-2 text-xs text-slate-400">Type to search people.</p>
                              ) : null}

                              {!mentionLoading && mentionQuery.trim() && mentionCandidates.length === 0 ? (
                                <p className="mt-2 text-xs text-slate-400">No users to mention.</p>
                              ) : null}

                              {!mentionLoading && mentionQuery.trim() && mentionCandidates.length > 0 ? (
                                <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                                  {mentionCandidates.map((member) => (
                                    <li key={member.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                                      <div className="min-w-0">
                                        <button
                                          type="button"
                                          onClick={() => onOpenUserProfile?.(member.id)}
                                          className="block truncate text-left text-xs font-medium text-slate-100 transition hover:text-cyan-200 hover:underline"
                                        >
                                          {member.name}
                                        </button>
                                        <p className="truncate text-[10px] text-slate-400">{member.email}</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleMentionUser(member.id)}
                                        disabled={mentioningUserId === member.id}
                                        className="rounded-full border border-cyan-300/40 bg-cyan-400/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-100 transition hover:bg-cyan-400/30 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {mentioningUserId === member.id ? 'Adding...' : 'Mention'}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {(selectedQuestion.mentions || []).length > 0 ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                          <span className="text-slate-400">Asked to:</span>
                          {(selectedQuestion.mentions || []).map((mention) => (
                            <span
                              key={mention.id || mention.user_id}
                              className="inline-flex items-center gap-1 rounded-full border border-cyan-300/0 bg-cyan-400/10 px-2 py-0.5 font-medium text-cyan-100"
                            >
                              <button
                                type="button"
                                onClick={() => onOpenUserProfile?.(mention.user_id)}
                                className="transition hover:underline"
                              >
                                {mention.user_name}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveMentionUser(mention.user_id)}
                                disabled={removingMentionUserId === mention.user_id}
                                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-cyan-200/0 bg-cyan-400/10 text-[10px] text-cyan-100 transition hover:bg-cyan-300/35 disabled:cursor-not-allowed disabled:opacity-60"
                                aria-label={`Remove mention for ${mention.user_name}`}
                              >
                                {removingMentionUserId === mention.user_id ? '...' : 'x'}
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {mentionError ? (
                        <p className="mt-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-200">
                          {mentionError}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-3 flex items-start gap-3">
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={handleToggleFollowQuestion}
                          disabled={followingQuestion}
                          className="text-xs font-medium text-white/50 transition hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {followingQuestion
                            ? (selectedQuestion.is_following ? 'Unfollowing...' : 'Following...')
                            : (selectedQuestion.is_following ? 'Unfollow' : 'Follow')}
                        </button>
                        <button
                          type="button"
                          onClick={handleStartQuestionEdit}
                          className="text-xs font-medium text-white/50 transition hover:text-cyan-200"
                        >
                          Edit
                        </button>
                        {selectedQuestion.closed_reason ? (
                          <button
                            type="button"
                            onClick={handleReopenQuestion}
                            className="text-xs font-medium text-white/50 transition hover:text-cyan-200"
                          >
                            Reopen
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleOpenCloseModal}
                            className="text-xs font-medium text-white/50 transition hover:text-cyan-200"
                          >
                            Close
                          </button>
                        )}
                        {selectedQuestion.delete_flag ? (
                          <button
                            type="button"
                            onClick={handleUndeleteQuestion}
                            disabled={deletingQuestion}
                            className="text-xs font-medium text-emerald-200 transition hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingQuestion ? 'Undeleting...' : 'Undelete'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleDeleteQuestion}
                            disabled={deletingQuestion}
                            className="text-xs font-medium text-white/50 transition hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingQuestion ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                        {selectedQuestion.can_offer_bounty ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBountyReason(BOUNTY_REASONS[0].title);
                              setShowBountyModal(true);
                            }}
                            className="text-xs font-medium text-white/50 transition hover:text-cyan-200"
                          >
                            Offer bounty
                          </button>
                        ) : null}
                      </div>

                      <div className="ml-auto shrink-0 text-right text-xs text-slate-400">
                        <div className="flex items-start justify-end gap-4">
                          {isActuallyEdited(selectedQuestion.created_at, selectedQuestion.modified_at) ? (
                            <div>
                              <p>edited {formatQuestionTime(selectedQuestion.modified_at)}</p>
                              {selectedQuestion.edited_by_username &&
                              selectedQuestion.edited_by_username !== selectedQuestion.user_name ? (
                                <p>
                                  <button
                                    type="button"
                                    onClick={() => onOpenUserProfile?.(selectedQuestion.edited_by)}
                                    className="transition hover:text-cyan-200 hover:underline"
                                  >
                                    {selectedQuestion.edited_by_username}
                                  </button>
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="rounded-xl bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200">
                            <span className="block font-medium">asked {formatQuestionTime(selectedQuestion.created_at)}</span>
                            <button
                              type="button"
                              onClick={() => onOpenUserProfile?.(selectedQuestion.user)}
                              className="block text-cyan-100 transition hover:text-white hover:underline"
                            >
                              {selectedQuestion.user_name}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <CommentSection
                      targetType="question"
                      targetId={selectedQuestion.id}
                      commentsCount={(selectedQuestion.comments || []).length}
                      commentData={questionCommentData}
                      collapsed={Boolean(collapsedCommentSections[buildCommentKey('question', selectedQuestion.id)])}
                      onToggleCollapsed={() => toggleCommentSection('question', selectedQuestion.id)}
                      draftValue={commentDrafts[buildCommentKey('question', selectedQuestion.id)] || ''}
                      onDraftChange={(value) => handleCommentDraftChange('question', selectedQuestion.id, value)}
                      onAddComment={() => handleAddComment('question', selectedQuestion.id, selectedQuestion.id)}
                      errorMessage={commentErrors[buildCommentKey('question', selectedQuestion.id)]}
                      showDeletedTree={Boolean(showDeletedTrees[buildCommentKey('question', selectedQuestion.id)])}
                      onShowDeletedTree={() =>
                        setShowDeletedTrees((prev) => ({
                          ...prev,
                          [buildCommentKey('question', selectedQuestion.id)]: true,
                        }))
                      }
                      activeCommentMenuKey={activeCommentMenuKey}
                      editingCommentKey={editingCommentKey}
                      editingCommentBody={editingCommentBody}
                      onEditingCommentBodyChange={setEditingCommentBody}
                      replyDrafts={replyDrafts}
                      activeReplyComposerKey={activeReplyComposerKey}
                      onToggleCommentMenu={toggleCommentMenu}
                      onToggleReplyComposer={toggleReplyComposer}
                      onReplyDraftChange={handleReplyDraftChange}
                      onSaveCommentEdit={handleSaveCommentEdit}
                      onStartCommentEdit={handleStartCommentEdit}
                      onDeleteComment={handleDeleteComment}
                      onCommentUpvote={handleCommentUpvote}
                      onAddReply={handleAddReply}
                      onCancelCommentEdit={cancelCommentEdit}
                      onCancelReplyComposer={cancelReplyComposer}
                      onOpenUserProfile={onOpenUserProfile}
                      formatTime={formatQuestionTime}
                      getCommentKey={buildCommentKey}
                      getCommentItemKey={buildCommentItemKey}
                    />
                  </div>
                </div>

                <div className="mt-3 border-t border-white/15" />

                {voteError ? (
                  <p className="mt-3 rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
                    {voteError}
                  </p>
                ) : null}

                {approvalError ? (
                  <p className="mt-3 rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
                    {approvalError}
                  </p>
                ) : null}

                {/* Answers section */}
                <div className="mt-4">
                  <h4 className="text-sm font-semibold tracking-[0.08em] text-slate-300 uppercase">
                    Answers ({selectedQuestion.answers ? selectedQuestion.answers.length : 0})
                  </h4>
                  {sortedAnswers.length > 0 ? (
                    <ul className="mt-3 space-y-3">
                      {sortedAnswers.map((answer) => {
                        const edited = isActuallyEdited(answer.created_at, answer.modified_at);
                        const editedByUsername = answer.edited_by_username || answer.user_name;
                        const showEditedByName = edited && editedByUsername && editedByUsername !== answer.user_name;
                        const answerCommentData = buildCommentData(answer.comments);
                        const isAnswerDeleted = Boolean(answer.delete_flag);
                        const disableAnswerVoting = Boolean(selectedQuestion.delete_flag || isAnswerDeleted);
                        const disableApprove = Boolean(!selectedQuestion.can_approve_answers || selectedQuestion.delete_flag || isAnswerDeleted);
                        const isBountyAwardedAnswer = selectedQuestion.bounty?.status === 'earned'
                          && selectedQuestion.bounty?.awarded_answer === answer.id;

                        return (
                          /* Answer voting component */ 
                          <li key={answer.id} className="rounded-2xl py-3">
                            <div className="flex items-start gap-2">
                              <div className="flex shrink-0 flex-col items-center gap-1">
                                <VotePanel
                                  score={answer.vote_count}
                                  currentVote={answer.current_user_vote}
                                  onUpvote={() => handleAnswerVote(answer.id, 1)}
                                  onDownvote={() => handleAnswerVote(answer.id, -1)}
                                  upvoteAriaLabel="Upvote answer"
                                  downvoteAriaLabel="Downvote answer"
                                  upvoteDisabled={disableAnswerVoting}
                                  downvoteDisabled={disableAnswerVoting}
                                  disabledClassName="cursor-not-allowed opacity-60 hover:bg-white/10"
                                  className="flex flex-col items-center gap-1 rounded-xl border border-white/0 bg-black/30 px-2 py-2"
                                />

                                {/* Answer approval component */ }
                                <button
                                  type="button"
                                  onClick={() => handleApproveAnswer(answer.id)}
                                  disabled={disableApprove}
                                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition ${
                                    selectedQuestion.approved_answer === answer.id
                                      ? 'border-emerald-300/70 bg-emerald-300/20 text-emerald-100 hover:bg-emerald-400/30'
                                      : 'border-white/10 bg-white/10 text-slate-400 hover:bg-white/15'
                                  } ${
                                    disableApprove
                                      ? 'cursor-not-allowed opacity-70 hover:bg-white/10'
                                      : ''
                                  }`}
                                  aria-label="Approve answer"
                                  title={
                                    selectedQuestion.delete_flag
                                      ? 'Cannot approve answers on a deleted question'
                                      : isAnswerDeleted
                                        ? 'Cannot approve a deleted answer'
                                        : selectedQuestion.can_approve_answers
                                      ? 'Mark as accepted answer'
                                      : 'Only the question author can approve an answer'
                                  }
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
                                    <path d="m5 12 5 5L20 7" />
                                  </svg>
                                </button>

                                {isBountyAwardedAnswer ? (
                                  <div
                                    className="inline-flex items-center justify-center rounded-full border border-amber-300/30 bg-amber-500/20 px-2 py-1 text-[10px] font-semibold text-amber-100"
                                    title="This answer received the bounty"
                                  >
                                    +{selectedQuestion.bounty?.amount || 50}
                                  </div>
                                ) : null}

                                {(selectedQuestion.bounty_amount || 0) > 0 && selectedQuestion.can_award_bounty ? (
                                  <button
                                    type="button"
                                    onClick={() => handleAwardBounty(answer.id)}
                                    disabled={isAnswerDeleted || awardingBountyAnswerId === answer.id}
                                    className={`rounded-full border px-2 py-1 text-[10px] font-semibold transition ${
                                      isAnswerDeleted
                                        ? 'cursor-not-allowed border-white/10 bg-white/10 text-slate-400 opacity-60'
                                        : 'border-amber-300/30 bg-amber-500/20 text-amber-100 hover:bg-amber-400/30'
                                    } ${awardingBountyAnswerId === answer.id ? 'opacity-70' : ''}`}
                                    title="Offer bounty to this answer"
                                  >
                                    {awardingBountyAnswerId === answer.id ? 'Giving...' : `+${selectedQuestion.bounty_amount}`}
                                  </button>
                                ) : null}
                              </div>

                              {/* Answer editing */}
                              <div className="min-w-0 flex-1">
                                {editingAnswerId === answer.id ? (
                                  <div className="space-y-3">
                                    <textarea
                                      value={editAnswerBody}
                                      onChange={(e) => setEditAnswerBody(e.target.value)}
                                      className="min-h-[180px] w-full rounded-3xl border border-white/0 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                                      required
                                    />

                                    {editAnswerError ? (
                                      <p className="rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
                                        {editAnswerError}
                                      </p>
                                    ) : null}

                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={handleSaveAnswerEdit}
                                        disabled={savingAnswerEdit}
                                        className="rounded-full bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {savingAnswerEdit ? 'Saving...' : 'Save'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingAnswerId(null);
                                          setEditAnswerBody('');
                                          setEditAnswerError('');
                                        }}
                                        className="rounded-full border border-white/0 bg-white/10 px-4 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/20"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                  {/* Answer body and username */ }
                                    <p
                                      className={`overflow-y-auto rounded-2xl border border-white/0 px-3 py-2 text-sm whitespace-pre-wrap ${
                                        isAnswerDeleted
                                          ? 'bg-rose-500/10 text-rose-200'
                                          : 'bg-white/5 text-slate-200'
                                      }`}
                                    >
                                      {answer.body}
                                    </p>

                                    <div className="mt-3 flex items-start gap-3">
                                        <div className="flex flex-col items-start gap-2">
                                            <div className="mt-3 flex items-center gap-2">
                                              <button
                                                  type="button"
                                                  onClick={() => handleStartAnswerEdit(answer)}
                                                  disabled={isAnswerDeleted}
                                                  className="text-xs font-medium text-white/50 transition hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                                                  >
                                                  Edit
                                              </button>
                                              {isAnswerDeleted ? (
                                                <button
                                                  type="button"
                                                  onClick={() => handleUndeleteAnswer(answer.id)}
                                                  disabled={deletingAnswerId === answer.id}
                                                  className="text-xs font-medium text-emerald-200 transition hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                  {deletingAnswerId === answer.id ? 'Undeleting...' : 'Undelete'}
                                                </button>
                                              ) : (
                                                <button
                                                  type="button"
                                                  onClick={() => handleDeleteAnswer(answer.id)}
                                                  disabled={deletingAnswerId === answer.id}
                                                  className="text-xs font-medium text-white/50 transition hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                  {deletingAnswerId === answer.id ? 'Deleting...' : 'Delete'}
                                                </button>
                                              )}
                                            </div>
                                        </div>
                                        <div className="ml-auto text-right text-sm text-slate-300">
                                          <div className="shrink-0 text-right text-xs text-slate-400">
                                            <div className="flex items-start justify-end gap-4">
                                            {edited ? (
                                              <div>
                                              <p>edited {formatQuestionTime(answer.modified_at)}</p>
                                              {showEditedByName ? (
                                                <p>
                                                  <button
                                                    type="button"
                                                    onClick={() => onOpenUserProfile?.(answer.edited_by)}
                                                    className="transition hover:text-cyan-200 hover:underline"
                                                  >
                                                    {editedByUsername}
                                                  </button>
                                                </p>
                                              ) : null}
                                              </div>
                                            ) : null}
                                            <div>
                                              <p>answered {formatQuestionTime(answer.created_at)}</p>
                                              <p>
                                                <button
                                                  type="button"
                                                  onClick={() => onOpenUserProfile?.(answer.user)}
                                                  className="transition hover:text-cyan-200 hover:underline"
                                                >
                                                  {answer.user_name}
                                                </button>
                                              </p>
                                            </div>
                                            </div>
                                          </div>
                                        </div>
                                    </div>

                                    <CommentSection
                                      targetType="answer"
                                      targetId={answer.id}
                                      commentsCount={(answer.comments || []).length}
                                      commentData={answerCommentData}
                                      collapsed={Boolean(collapsedCommentSections[buildCommentKey('answer', answer.id)])}
                                      onToggleCollapsed={() => toggleCommentSection('answer', answer.id)}
                                      draftValue={commentDrafts[buildCommentKey('answer', answer.id)] || ''}
                                      onDraftChange={(value) => handleCommentDraftChange('answer', answer.id, value)}
                                      onAddComment={() => handleAddComment('answer', answer.id, answer.id)}
                                      errorMessage={commentErrors[buildCommentKey('answer', answer.id)]}
                                      showDeletedTree={Boolean(showDeletedTrees[buildCommentKey('answer', answer.id)])}
                                      onShowDeletedTree={() =>
                                        setShowDeletedTrees((prev) => ({
                                          ...prev,
                                          [buildCommentKey('answer', answer.id)]: true,
                                        }))
                                      }
                                      activeCommentMenuKey={activeCommentMenuKey}
                                      editingCommentKey={editingCommentKey}
                                      editingCommentBody={editingCommentBody}
                                      onEditingCommentBodyChange={setEditingCommentBody}
                                      replyDrafts={replyDrafts}
                                      activeReplyComposerKey={activeReplyComposerKey}
                                      onToggleCommentMenu={toggleCommentMenu}
                                      onToggleReplyComposer={toggleReplyComposer}
                                      onReplyDraftChange={handleReplyDraftChange}
                                      onSaveCommentEdit={handleSaveCommentEdit}
                                      onStartCommentEdit={handleStartCommentEdit}
                                      onDeleteComment={handleDeleteComment}
                                      onCommentUpvote={handleCommentUpvote}
                                      onAddReply={handleAddReply}
                                      onCancelCommentEdit={cancelCommentEdit}
                                      onCancelReplyComposer={cancelReplyComposer}
                                      onOpenUserProfile={onOpenUserProfile}
                                      formatTime={formatQuestionTime}
                                      getCommentKey={buildCommentKey}
                                      getCommentItemKey={buildCommentItemKey}
                                      containerClassName="mt-3 max-w-lg"
                                    />
                                    <div className="mt-3 border-t border-white/15" />
                                  </>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">No answers yet.</p>
                  )}

                  {/* Add answer section */}
                  {showAnswerSection && !selectedQuestion.closed_reason && !selectedQuestion.delete_flag ? (
                    <div className="w-full rounded-2xl border border-white/10 bg-black/20 p-4">
                      <form onSubmit={handleAnswerSubmit} className="space-y-4">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-200">Your Answer</label>
                          <textarea
                            value={answerBody}
                            onChange={(e) => setAnswerBody(e.target.value)}
                            className="min-h-[150px] w-full rounded-3xl border border-white/15 bg-black/20 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                            placeholder="Write your answer here..."
                            required
                          />
                        </div>

                        {answerError ? (
                          <p className="rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
                            {answerError}
                          </p>
                        ) : null}

                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            disabled={submittingAnswer}
                            className="rounded-full bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {submittingAnswer ? 'Posting...' : 'Post Answer'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAnswerSection(false);
                              setAnswerError('');
                            }}
                            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/20"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : null}

                  {!selectedQuestion.closed_reason && !selectedQuestion.delete_flag ? (
                    <div className="mt-3 flex flex-col items-start gap-3">
                      <button
                          type="button"
                          onClick={() => {
                          setAnswerError('');
                          setShowAnswerSection(true);
                          }}
                          className="rounded-full bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400"
                      >
                          Answer this question
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            )}
        </div>
      ) : null}
    </>
  );
}

export default QuestionTab;
