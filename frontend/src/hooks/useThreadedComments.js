import { useCallback } from 'react';
import { commentService, voteService } from '../services/api';
import { buildCommentItemKey, buildCommentKey } from '../components/CommentSection';

function useThreadedComments({
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
  getTargetComments,
  createCommentPayload,
  normalizeCreatedComment = (comment) => comment,
  addCommentErrorMessage = 'Failed to add comment.',
  addReplyErrorMessage = 'Failed to add reply.',
  updateCommentErrorMessage = 'Failed to update comment.',
  deleteCommentErrorMessage = 'Failed to delete comment.',
  voteCommentErrorMessage = 'Failed to vote on comment.',
}) {
  const cancelCommentEdit = useCallback(() => {
    setEditingCommentKey('');
    setEditingCommentBody('');
  }, [setEditingCommentKey, setEditingCommentBody]);

  const cancelReplyComposer = useCallback(() => {
    setActiveReplyComposerKey('');
  }, [setActiveReplyComposerKey]);

  const handleCommentDraftChange = useCallback(
    (targetType, targetId, value) => {
      const key = buildCommentKey(targetType, targetId);
      setCommentDrafts((prev) => ({
        ...prev,
        [key]: value,
      }));
      setCommentErrors((prev) => ({
        ...prev,
        [key]: '',
      }));
    },
    [setCommentDrafts, setCommentErrors],
  );

  const handleAddComment = useCallback(
    async (targetType, targetId, postId) => {
      const key = buildCommentKey(targetType, targetId);
      const body = (commentDrafts[key] || '').trim();

      if (!body) {
        setCommentErrors((prev) => ({
          ...prev,
          [key]: 'Comment cannot be empty.',
        }));
        return;
      }

      try {
        const created = await commentService.createComment(
          createCommentPayload({ targetType, targetId, postId, parentCommentId: null, body }),
        );

        updateCommentCollection(targetType, targetId, (comments) => [
          ...(comments || []),
          normalizeCreatedComment(created, { targetType, targetId, isReply: false }),
        ]);

        setCommentDrafts((prev) => ({
          ...prev,
          [key]: '',
        }));
        setCommentErrors((prev) => ({
          ...prev,
          [key]: '',
        }));
      } catch (err) {
        setCommentErrors((prev) => ({
          ...prev,
          [key]: err.response?.data?.error || addCommentErrorMessage,
        }));
      }
    },
    [
      commentDrafts,
      setCommentErrors,
      setCommentDrafts,
      createCommentPayload,
      updateCommentCollection,
      normalizeCreatedComment,
      addCommentErrorMessage,
    ],
  );

  const toggleCommentSection = useCallback(
    (targetType, targetId) => {
      const key = buildCommentKey(targetType, targetId);
      setCollapsedCommentSections((prev) => ({
        ...prev,
        [key]: !prev[key],
      }));
    },
    [setCollapsedCommentSections],
  );

  const toggleCommentMenu = useCallback(
    (targetType, targetId, commentId) => {
      const itemKey = buildCommentItemKey(targetType, targetId, commentId);
      setActiveCommentMenuKey((prev) => (prev === itemKey ? '' : itemKey));
    },
    [setActiveCommentMenuKey],
  );

  const toggleReplyComposer = useCallback(
    (itemKey) => {
      setActiveReplyComposerKey((prev) => (prev === itemKey ? '' : itemKey));
    },
    [setActiveReplyComposerKey],
  );

  const handleReplyDraftChange = useCallback(
    (itemKey, value) => {
      setReplyDrafts((prev) => ({
        ...prev,
        [itemKey]: value,
      }));
    },
    [setReplyDrafts],
  );

  const handleAddReply = useCallback(
    async (targetType, targetId, parentItemKey, parentCommentId, depth) => {
      if (depth >= 2) {
        return;
      }

      const key = buildCommentKey(targetType, targetId);
      const body = (replyDrafts[parentItemKey] || '').trim();

      if (!body) {
        setCommentErrors((prev) => ({
          ...prev,
          [key]: 'Reply cannot be empty.',
        }));
        return;
      }

      try {
        const created = await commentService.createComment(
          createCommentPayload({
            targetType,
            targetId,
            postId: targetId,
            parentCommentId,
            body,
          }),
        );

        updateCommentCollection(targetType, targetId, (comments) => [
          ...(comments || []),
          normalizeCreatedComment(created, { targetType, targetId, isReply: true }),
        ]);

        setReplyDrafts((prev) => ({
          ...prev,
          [parentItemKey]: '',
        }));
        setActiveReplyComposerKey('');
        setCommentErrors((prev) => ({
          ...prev,
          [key]: '',
        }));
      } catch (err) {
        setCommentErrors((prev) => ({
          ...prev,
          [key]: err.response?.data?.error || addReplyErrorMessage,
        }));
      }
    },
    [
      replyDrafts,
      setCommentErrors,
      createCommentPayload,
      updateCommentCollection,
      normalizeCreatedComment,
      setReplyDrafts,
      setActiveReplyComposerKey,
      addReplyErrorMessage,
    ],
  );

  const handleStartCommentEdit = useCallback(
    (targetType, targetId, comment) => {
      setEditingCommentKey(buildCommentItemKey(targetType, targetId, comment.id));
      setEditingCommentBody(comment.body || '');
      setActiveCommentMenuKey('');
      setCommentErrors((prev) => ({
        ...prev,
        [buildCommentKey(targetType, targetId)]: '',
      }));
    },
    [setEditingCommentKey, setEditingCommentBody, setActiveCommentMenuKey, setCommentErrors],
  );

  const handleSaveCommentEdit = useCallback(
    async (targetType, targetId, commentId) => {
      const key = buildCommentKey(targetType, targetId);
      const nextBody = editingCommentBody.trim();

      if (!nextBody) {
        setCommentErrors((prev) => ({
          ...prev,
          [key]: 'Comment cannot be empty.',
        }));
        return;
      }

      try {
        const updated = await commentService.updateComment(commentId, { body: nextBody });

        updateCommentCollection(targetType, targetId, (comments) =>
          (comments || []).map((comment) =>
            comment.id === commentId ? { ...comment, ...updated } : comment,
          ),
        );

        setEditingCommentKey('');
        setEditingCommentBody('');
        setCommentErrors((prev) => ({
          ...prev,
          [key]: '',
        }));
      } catch (err) {
        setCommentErrors((prev) => ({
          ...prev,
          [key]: err.response?.data?.error || updateCommentErrorMessage,
        }));
      }
    },
    [
      editingCommentBody,
      setCommentErrors,
      updateCommentCollection,
      setEditingCommentKey,
      setEditingCommentBody,
      updateCommentErrorMessage,
    ],
  );

  const handleDeleteComment = useCallback(
    async (targetType, targetId, commentId) => {
      const key = buildCommentKey(targetType, targetId);

      try {
        await commentService.deleteComment(commentId);
        updateCommentCollection(targetType, targetId, (comments) =>
          (comments || []).filter((comment) => comment.id !== commentId),
        );
        setActiveCommentMenuKey('');
        if (editingCommentKey === buildCommentItemKey(targetType, targetId, commentId)) {
          setEditingCommentKey('');
          setEditingCommentBody('');
        }
        setCommentErrors((prev) => ({
          ...prev,
          [key]: '',
        }));
      } catch (err) {
        setCommentErrors((prev) => ({
          ...prev,
          [key]: err.response?.data?.error || deleteCommentErrorMessage,
        }));
      }
    },
    [
      updateCommentCollection,
      setActiveCommentMenuKey,
      editingCommentKey,
      setEditingCommentKey,
      setEditingCommentBody,
      setCommentErrors,
      deleteCommentErrorMessage,
    ],
  );

  const handleCommentUpvote = useCallback(
    async (targetType, targetId, commentId) => {
      const key = buildCommentKey(targetType, targetId);
      const comment = (getTargetComments(targetType, targetId) || []).find((item) => item.id === commentId);
      const currentVote = Number(comment?.current_user_vote || 0);

      try {
        const result =
          currentVote === 1
            ? await voteService.removeVote({ commentId })
            : await voteService.submitVote({ commentId, vote: 1 });

        updateCommentCollection(targetType, targetId, (comments) =>
          (comments || []).map((item) =>
            item.id === commentId
              ? {
                  ...item,
                  vote_count: result.vote_count,
                  current_user_vote: result.vote,
                }
              : item,
          ),
        );

        setCommentErrors((prev) => ({
          ...prev,
          [key]: '',
        }));
      } catch (err) {
        setCommentErrors((prev) => ({
          ...prev,
          [key]: err.response?.data?.error || voteCommentErrorMessage,
        }));
      }
    },
    [getTargetComments, updateCommentCollection, setCommentErrors, voteCommentErrorMessage],
  );

  return {
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
  };
}

export default useThreadedComments;