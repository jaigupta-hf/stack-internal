import { useCallback, useEffect, useState } from 'react';
import { collectionService, postService } from '../services/api';
import {
  buildCommentData,
  EMPTY_COMMENT_DATA,
} from '../components/CommentSection';
import { formatRelativeTimestamp } from '../utils/dateTime';
import useCommentSectionState from './useCommentSectionState';
import useCollectionUrlState, { useSyncCollectionUrlState } from './useCollectionUrlSync';
import useThreadedComments from './useThreadedComments';

const articleTypes = new Set([20, 21, 22, 23]);

const formatCollectionTime = (timestamp) => formatRelativeTimestamp(timestamp);

const getPostTypeLabel = (post) => {
  if (post.type_label) {
    return post.type_label;
  }

  return articleTypes.has(Number(post.type)) ? 'Article' : 'Question';
};

const isArticlePost = (post) => articleTypes.has(Number(post.type));

function useCollectionsTabController({ team }) {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openingCollection, setOpeningCollection] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [postSearchTerm, setPostSearchTerm] = useState('');
  const [postSearchResults, setPostSearchResults] = useState([]);
  const [searchingPosts, setSearchingPosts] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [addingPostId, setAddingPostId] = useState(null);
  const [collectionPostCards, setCollectionPostCards] = useState({});
  const [selectedCollectionPost, setSelectedCollectionPost] = useState(null);
  const [openingCollectionPost, setOpeningCollectionPost] = useState(false);
  const [collectionPostError, setCollectionPostError] = useState('');
  const [collectionVoteError, setCollectionVoteError] = useState('');
  const [collectionBookmarkError, setCollectionBookmarkError] = useState('');
  const [votingCollection, setVotingCollection] = useState(false);
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

  const clearCollectionSelectionFromUrl = useCallback(() => {
    setSelectedCollection(null);
    setSelectedCollectionPost(null);
    setCollectionPostCards({});
    setDetailError('');
    setCollectionPostError('');
    setSearchError('');
    setCollectionBookmarkError('');
    setPostSearchTerm('');
    setPostSearchResults([]);
    resetCommentSectionState();
  }, [resetCommentSectionState]);

  const clearCollectionPostSelectionFromUrl = useCallback(() => {
    setSelectedCollectionPost(null);
    setCollectionPostError('');
  }, []);

  const {
    getCollectionIdFromUrl,
    getCollectionPostIdFromUrl,
    getCollectionPostTypeFromUrl,
    setCollectionStateInUrl,
  } = useCollectionUrlState();

  useEffect(() => {
    const loadCollections = async () => {
      if (!team?.id) {
        setCollections([]);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const data = await collectionService.listCollections(team.id);
        setCollections(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load collections.');
      } finally {
        setLoading(false);
      }
    };

    loadCollections();
  }, [team?.id]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setFormError('');
  };

  const openCollection = useCallback(async (collectionId, updateUrl = false) => {
    setOpeningCollection(true);
    setDetailError('');
    setSearchError('');
    setCollectionPostError('');
    setPostSearchTerm('');
    setPostSearchResults([]);
    setSelectedCollectionPost(null);
    setCollectionVoteError('');
    setCollectionBookmarkError('');
    resetCommentSectionState();

    try {
      const detail = await collectionService.getCollectionDetail(collectionId);
      setSelectedCollection(detail);
      setCollections((prev) =>
        prev.map((item) => (item.id === detail.id ? { ...item, views_count: detail.views_count } : item)),
      );

      if (updateUrl) {
        setCollectionStateInUrl(collectionId);
      }
    } catch (err) {
      setDetailError(err.response?.data?.error || 'Failed to open collection.');
    } finally {
      setOpeningCollection(false);
    }
  }, [setCollectionStateInUrl, resetCommentSectionState]);

  const openCollectionPost = useCallback(async (postRef, updateUrl = false) => {
    if (!postRef?.post_id) {
      return;
    }

    const postId = Number(postRef.post_id);
    const article = isArticlePost(postRef);

    setOpeningCollectionPost(true);
    setCollectionPostError('');

    setSelectedCollectionPost({
      post_id: postId,
      is_article: article,
      type: Number(postRef.type),
      title: postRef.title,
    });

    if (updateUrl && selectedCollection?.id) {
      setCollectionStateInUrl(selectedCollection.id, {
        id: postId,
        type: article ? 'a' : 'q',
      });
    }

    setOpeningCollectionPost(false);
  }, [selectedCollection?.id, setCollectionStateInUrl]);

  useSyncCollectionUrlState({
    teamId: team?.id,
    selectedCollection,
    selectedCollectionPost,
    getCollectionIdFromUrl,
    getCollectionPostIdFromUrl,
    getCollectionPostTypeFromUrl,
    openCollection,
    openCollectionPost,
    clearCollectionSelectionFromUrl,
    clearCollectionPostSelectionFromUrl,
  });

  const handleBackToCollections = () => {
    setSelectedCollection(null);
    setSelectedCollectionPost(null);
    setCollectionPostCards({});
    setDetailError('');
    setCollectionPostError('');
    setSearchError('');
    setCollectionBookmarkError('');
    setPostSearchTerm('');
    setPostSearchResults([]);
    setCollectionVoteError('');
    setCollectionBookmarkError('');
    resetCommentSectionState();

    if (getCollectionIdFromUrl()) {
      setCollectionStateInUrl(null, null, true);
    }
  };

  const handleBackToCollectionPosts = () => {
    if (!selectedCollection) {
      return;
    }

    setSelectedCollectionPost(null);
    setCollectionPostError('');

    if (getCollectionPostIdFromUrl()) {
      setCollectionStateInUrl(selectedCollection.id, null, true);
    }
  };

  const handleCollectionUpvote = async () => {
    if (!selectedCollection || votingCollection) {
      return;
    }

    const currentVote = Number(selectedCollection.current_user_vote || 0);
    setVotingCollection(true);
    setCollectionVoteError('');

    try {
      const result =
        currentVote === 1
          ? await collectionService.removeCollectionUpvote(selectedCollection.id)
          : await collectionService.upvoteCollection(selectedCollection.id);

      setSelectedCollection((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          vote_count: result.vote_count,
          current_user_vote: result.vote,
        };
      });

      setCollections((prev) =>
        prev.map((item) =>
          item.id === selectedCollection.id ? { ...item, vote_count: result.vote_count } : item,
        ),
      );
    } catch (err) {
      setCollectionVoteError(err.response?.data?.error || 'Failed to update vote.');
    } finally {
      setVotingCollection(false);
    }
  };

  const handleToggleCollectionBookmark = async () => {
    if (!selectedCollection) {
      return;
    }

    const isBookmarked = Boolean(selectedCollection.is_bookmarked);
    setCollectionBookmarkError('');

    try {
      if (isBookmarked) {
        await postService.removeBookmark({ collectionId: selectedCollection.id });
      } else {
        await postService.addBookmark({ collection_id: selectedCollection.id });
      }

      setSelectedCollection((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          is_bookmarked: !isBookmarked,
          bookmarks_count: Math.max((prev.bookmarks_count || 0) + (isBookmarked ? -1 : 1), 0),
        };
      });

      setCollections((prev) =>
        prev.map((item) =>
          item.id === selectedCollection.id
            ? {
                ...item,
                bookmarks_count: Math.max((item.bookmarks_count || 0) + (isBookmarked ? -1 : 1), 0),
              }
            : item,
        ),
      );
    } catch (err) {
      setCollectionBookmarkError(err.response?.data?.error || 'Failed to update bookmark.');
    }
  };

  const updateCommentCollection = (_targetType, _targetId, updater) => {
    setSelectedCollection((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        comments: updater(prev.comments || []),
      };
    });
  };

  const getCollectionTargetComments = useCallback(
    () => selectedCollection?.comments || [],
    [selectedCollection],
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
    getTargetComments: getCollectionTargetComments,
    createCommentPayload: ({ targetId, parentCommentId, body }) =>
      parentCommentId ? { parent_comment_id: parentCommentId, body } : { collection_id: targetId, body },
  });

  useEffect(() => {
    if (!selectedCollection) {
      return;
    }

    const query = postSearchTerm.trim();
    if (!query) {
      setPostSearchResults([]);
      setSearchingPosts(false);
      setSearchError('');
      return;
    }

    const debounce = setTimeout(async () => {
      setSearchingPosts(true);
      setSearchError('');
      try {
        const results = await collectionService.searchPosts(selectedCollection.id, query);
        setPostSearchResults(results);
      } catch (err) {
        setSearchError(err.response?.data?.error || 'Failed to search posts.');
      } finally {
        setSearchingPosts(false);
      }
    }, 250);

    return () => clearTimeout(debounce);
  }, [selectedCollection, postSearchTerm]);

  useEffect(() => {
    const loadCollectionPostCards = async () => {
      if (!selectedCollection || !team?.id) {
        setCollectionPostCards({});
        return;
      }

      const refs = selectedCollection.posts || [];
      if (refs.length === 0) {
        setCollectionPostCards({});
        return;
      }

      const questionIds = refs.filter((item) => !isArticlePost(item)).map((item) => Number(item.post_id));
      const articleIds = refs.filter((item) => isArticlePost(item)).map((item) => Number(item.post_id));

      try {
        const [questions, articles] = await Promise.all([
          questionIds.length > 0 ? postService.listQuestions(team.id) : Promise.resolve([]),
          articleIds.length > 0 ? postService.listArticles(team.id) : Promise.resolve([]),
        ]);

        const questionMap = new Map(questions.map((item) => [item.id, item]));
        const articleMap = new Map(articles.map((item) => [item.id, item]));

        const nextCards = {};
        refs.forEach((ref) => {
          const postId = Number(ref.post_id);
          if (isArticlePost(ref)) {
            nextCards[postId] = {
              ...ref,
              ...(articleMap.get(postId) || {}),
              post_id: postId,
              type: Number(ref.type),
            };
            return;
          }

          nextCards[postId] = {
            ...ref,
            ...(questionMap.get(postId) || {}),
            post_id: postId,
            type: Number(ref.type),
          };
        });

        setCollectionPostCards(nextCards);
      } catch (_err) {
        const fallbackCards = {};
        refs.forEach((ref) => {
          fallbackCards[Number(ref.post_id)] = { ...ref, post_id: Number(ref.post_id), type: Number(ref.type) };
        });
        setCollectionPostCards(fallbackCards);
      }
    };

    loadCollectionPostCards();
  }, [selectedCollection, team?.id]);

  const handleAddPost = async (postId) => {
    if (!selectedCollection) {
      return;
    }

    setAddingPostId(postId);
    setSearchError('');
    try {
      const added = await collectionService.addPostToCollection(selectedCollection.id, postId);

      setSelectedCollection((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          posts: [...(prev.posts || []), added],
        };
      });

      setCollectionPostCards((prev) => ({
        ...prev,
        [added.post_id]: {
          ...added,
          post_id: Number(added.post_id),
          type: Number(added.type),
        },
      }));

      setPostSearchResults((prev) =>
        prev.map((item) => (item.id === postId ? { ...item, already_added: true } : item)),
      );
    } catch (err) {
      setSearchError(err.response?.data?.error || 'Failed to add post to collection.');
    } finally {
      setAddingPostId(null);
    }
  };

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    setFormError('');

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle) {
      setFormError('Title is required.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await collectionService.createCollection({
        team_id: team.id,
        title: trimmedTitle,
        description: trimmedDescription,
      });

      setCollections((prev) => [created, ...prev]);
      resetForm();
      setShowCreateModal(false);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create collection.');
    } finally {
      setSubmitting(false);
    }
  };

  const collectionCommentData = selectedCollection
    ? buildCommentData(selectedCollection.comments)
    : EMPTY_COMMENT_DATA;

  return {
    collections,
    loading,
    openingCollection,
    error,
    detailError,
    selectedCollection,
    showCreateModal,
    title,
    description,
    submitting,
    formError,
    postSearchTerm,
    postSearchResults,
    searchingPosts,
    searchError,
    addingPostId,
    collectionPostCards,
    selectedCollectionPost,
    openingCollectionPost,
    collectionPostError,
    collectionVoteError,
    collectionBookmarkError,
    votingCollection,
    commentDrafts,
    commentErrors,
    collapsedCommentSections,
    activeCommentMenuKey,
    editingCommentKey,
    editingCommentBody,
    replyDrafts,
    activeReplyComposerKey,
    showDeletedTrees,
    collectionCommentData,
    formatCollectionTime,
    getPostTypeLabel,
    isArticlePost,
    setShowCreateModal,
    setTitle,
    setDescription,
    setPostSearchTerm,
    setShowDeletedTrees,
    setEditingCommentBody,
    resetForm,
    handleBackToCollections,
    handleBackToCollectionPosts,
    handleCollectionUpvote,
    handleToggleCollectionBookmark,
    handleCommentDraftChange,
    handleAddComment,
    toggleCommentSection,
    toggleCommentMenu,
    toggleReplyComposer,
    handleReplyDraftChange,
    handleSaveCommentEdit,
    handleStartCommentEdit,
    handleDeleteComment,
    handleCommentUpvote,
    handleAddReply,
    cancelCommentEdit,
    cancelReplyComposer,
    handleAddPost,
    handleCreateCollection,
    openCollection,
    openCollectionPost,
  };
}

export default useCollectionsTabController;
