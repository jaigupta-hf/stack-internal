import { useCallback, useEffect, useState } from 'react';
import { buildCommentData, EMPTY_COMMENT_DATA } from '../../components/CommentSection';
import { formatVerboseRelativeTime } from '../../utils/dateTime';
import useEntityIdInUrl from '../useEntityIdInUrl';
import useCommentSectionState from '../useCommentSectionState';
import useTagPreferences from '../useTagPreferences';
import useThreadedComments from '../useThreadedComments';
import { formatArticleListTime, formatArticleTime } from './articleTabConstants';
import useArticlesListDomain from './useArticlesListDomain';
import useArticlesEditorDomain from './useArticlesEditorDomain';
import { useAuth } from '../../context/AuthContext';

function useArticlesTabController({ team }) {
  const { user } = useAuth();
  const currentUserId = Number(user?.id || 0);
  const teamId = team?.id;
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [articleVoteError, setArticleVoteError] = useState('');

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

  const {
    getEntityIdFromUrl: getArticleIdFromUrl,
    setEntityIdInUrl: setArticleIdInUrl,
  } = useEntityIdInUrl('article');

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
  } = useTagPreferences({ teamId, clearPreferencesOnLoadError: true });

  const listDomain = useArticlesListDomain({
    teamId,
    selectedArticle,
    setSelectedArticle,
    resetCommentSectionState,
    setCommentErrors,
    setArticleVoteError,
    getArticleIdFromUrl,
    setArticleIdInUrl,
  });

  const editor = useArticlesEditorDomain({
    currentUserId,
    teamId,
    selectedArticle,
    setSelectedArticle,
    setArticles: listDomain.setArticles,
  });

  useEffect(() => {
    editor.resetEditState();
  }, [teamId]);

  const handleBackToArticleList = useCallback(() => {
    listDomain.handleBackToArticleList();
    editor.resetEditState();
  }, [listDomain, editor]);

  const openArticle = useCallback(async (articleId, updateUrl = false) => {
    await listDomain.openArticle(articleId, updateUrl);
    editor.resetEditState();
  }, [listDomain, editor]);

  const handleApplyArticleTagFilter = useCallback((tagName) => {
    if (!tagName) {
      return;
    }

    listDomain.setSelectedArticleTagFilter(tagName);
    if (selectedArticle) {
      handleBackToArticleList();
    }
  }, [handleBackToArticleList, listDomain, selectedArticle]);

  const updateCommentCollection = (targetType, targetId, updater) => {
    setSelectedArticle((prev) => {
      if (!prev) {
        return prev;
      }

      if (targetType !== 'article') {
        return prev;
      }

      return {
        ...prev,
        comments: updater(prev.comments || []),
      };
    });
  };

  const getArticleTargetComments = useCallback(
    (targetType) => (targetType === 'article' ? selectedArticle?.comments || [] : []),
    [selectedArticle],
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
    getTargetComments: getArticleTargetComments,
    createCommentPayload: ({ postId, parentCommentId, body }) =>
      parentCommentId ? { parent_comment_id: parentCommentId, body } : { post_id: postId, body },
    normalizeCreatedComment: (comment) => ({ ...comment, current_user_vote: 0 }),
  });

  const articleCommentData = selectedArticle
    ? buildCommentData(selectedArticle.comments)
    : EMPTY_COMMENT_DATA;

  return {
    openingArticle: listDomain.openingArticle,
    setOpeningArticle: listDomain.setOpeningArticle,
    selectedArticle,
    setSelectedArticle,
    articleVoteError,
    setArticleVoteError,
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
    showCreateModal: editor.showCreateModal,
    setShowCreateModal: editor.setShowCreateModal,
    title: editor.title,
    setTitle: editor.setTitle,
    articleType: editor.articleType,
    setArticleType: editor.setArticleType,
    body: editor.body,
    setBody: editor.setBody,
    tagInput: editor.tagInput,
    setTagInput: editor.setTagInput,
    articleTags: editor.articleTags,
    setArticleTags: editor.setArticleTags,
    tagSuggestions: editor.tagSuggestions,
    setTagSuggestions: editor.setTagSuggestions,
    searchingTags: editor.searchingTags,
    setSearchingTags: editor.setSearchingTags,
    submitting: editor.submitting,
    setSubmitting: editor.setSubmitting,
    formError: editor.formError,
    setFormError: editor.setFormError,
    tagError: editor.tagError,
    setTagError: editor.setTagError,
    isEditingArticle: editor.isEditingArticle,
    setIsEditingArticle: editor.setIsEditingArticle,
    editTitle: editor.editTitle,
    setEditTitle: editor.setEditTitle,
    editArticleType: editor.editArticleType,
    setEditArticleType: editor.setEditArticleType,
    editBody: editor.editBody,
    setEditBody: editor.setEditBody,
    editTagInput: editor.editTagInput,
    setEditTagInput: editor.setEditTagInput,
    editTags: editor.editTags,
    setEditTags: editor.setEditTags,
    editTagSuggestions: editor.editTagSuggestions,
    setEditTagSuggestions: editor.setEditTagSuggestions,
    searchingEditTags: editor.searchingEditTags,
    setSearchingEditTags: editor.setSearchingEditTags,
    editError: editor.editError,
    setEditError: editor.setEditError,
    editTagError: editor.editTagError,
    setEditTagError: editor.setEditTagError,
    savingEdit: editor.savingEdit,
    setSavingEdit: editor.setSavingEdit,
    articles: listDomain.articles,
    setArticles: listDomain.setArticles,
    loading: listDomain.loading,
    setLoading: listDomain.setLoading,
    error: listDomain.error,
    setError: listDomain.setError,
    selectedArticleTagFilter: listDomain.selectedArticleTagFilter,
    setSelectedArticleTagFilter: listDomain.setSelectedArticleTagFilter,
    getArticleIdFromUrl,
    setArticleIdInUrl,
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
    normalizeTagName: editor.normalizeTagName,
    isNumericOnlyTag: editor.isNumericOnlyTag,
    addTag: editor.addTag,
    removeTag: editor.removeTag,
    addEditTag: editor.addEditTag,
    removeEditTag: editor.removeEditTag,
    resetCreateForm: editor.resetCreateForm,
    handleCreateArticle: editor.handleCreateArticle,
    typeLabelByCode: editor.typeLabelByCode,
    visibleArticles: listDomain.visibleArticles,
    articleTagCounts: listDomain.articleTagCounts,
    handleApplyArticleTagFilter,
    openArticle,
    handleStartArticleEdit: editor.handleStartArticleEdit,
    handleCancelArticleEdit: editor.handleCancelArticleEdit,
    handleSaveArticleEdit: editor.handleSaveArticleEdit,
    handleBackToArticleList,
    handleArticleUpvote: listDomain.handleArticleUpvote,
    handleListArticleUpvote: listDomain.handleListArticleUpvote,
    handleToggleArticleBookmark: listDomain.handleToggleArticleBookmark,
    updateCommentCollection,
    getArticleTargetComments,
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
    articleCommentData,
    ARTICLE_TYPE_OPTIONS: editor.ARTICLE_TYPE_OPTIONS,
    formatArticleTime,
    formatArticleListTime,
    formatVerboseRelativeTime,
  };
}

export default useArticlesTabController;
