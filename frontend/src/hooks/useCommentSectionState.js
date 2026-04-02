import { useCallback, useState } from 'react';

function useCommentSectionState() {
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentErrors, setCommentErrors] = useState({});
  const [collapsedCommentSections, setCollapsedCommentSections] = useState({});
  const [activeCommentMenuKey, setActiveCommentMenuKey] = useState('');
  const [editingCommentKey, setEditingCommentKey] = useState('');
  const [editingCommentBody, setEditingCommentBody] = useState('');
  const [replyDrafts, setReplyDrafts] = useState({});
  const [activeReplyComposerKey, setActiveReplyComposerKey] = useState('');
  const [showDeletedTrees, setShowDeletedTrees] = useState({});

  const resetCommentSectionState = useCallback(() => {
    setCommentDrafts({});
    setCommentErrors({});
    setCollapsedCommentSections({});
    setActiveCommentMenuKey('');
    setEditingCommentKey('');
    setEditingCommentBody('');
    setReplyDrafts({});
    setActiveReplyComposerKey('');
    setShowDeletedTrees({});
  }, []);

  return {
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
  };
}

export default useCommentSectionState;
