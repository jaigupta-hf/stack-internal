import { useCallback, useEffect, useState } from 'react';
import { collectionService, commentService, postService, voteService } from '../../services/api';
import QuestionTab from './QuestionTab';
import ArticlesTab from './ArticlesTab';
import CommentSection, { buildCommentData, EMPTY_COMMENT_DATA } from '../../components/CommentSection';

const istDayFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
});

const istMonthFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  month: 'long',
});

const istTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const getOrdinal = (day) => {
  if (day >= 11 && day <= 13) {
    return `${day}th`;
  }

  const lastDigit = day % 10;
  if (lastDigit === 1) {
    return `${day}st`;
  }
  if (lastDigit === 2) {
    return `${day}nd`;
  }
  if (lastDigit === 3) {
    return `${day}rd`;
  }
  return `${day}th`;
};

const formatCollectionTime = (timestamp) => {
  const created = new Date(timestamp);
  if (Number.isNaN(created.getTime())) {
    return '';
  }

  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMinutes < 60) {
    const minutes = Math.max(diffMinutes, 1);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }

  const day = Number(istDayFormatter.format(created));
  const month = istMonthFormatter.format(created).toLowerCase();
  const time = istTimeFormatter.format(created);
  return `${getOrdinal(day)} ${month} at ${time}`;
};

const articleTypes = new Set([20, 21, 22, 23]);

const getPostTypeLabel = (post) => {
  if (post.type_label) {
    return post.type_label;
  }

  return articleTypes.has(Number(post.type)) ? 'Article' : 'Question';
};

const isArticlePost = (post) => articleTypes.has(Number(post.type));

const getPositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

function CollectionsTab({ team, isTeamAdmin, onOpenUserProfile }) {
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
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentErrors, setCommentErrors] = useState({});
  const [collapsedCommentSections, setCollapsedCommentSections] = useState({});
  const [activeCommentMenuKey, setActiveCommentMenuKey] = useState('');
  const [editingCommentKey, setEditingCommentKey] = useState('');
  const [editingCommentBody, setEditingCommentBody] = useState('');
  const [replyDrafts, setReplyDrafts] = useState({});
  const [activeReplyComposerKey, setActiveReplyComposerKey] = useState('');
  const [showDeletedTrees, setShowDeletedTrees] = useState({});

  const getCollectionIdFromUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    return getPositiveInteger(params.get('collection'));
  }, []);

  const getCollectionPostIdFromUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    return getPositiveInteger(params.get('collection_post'));
  }, []);

  const getCollectionPostTypeFromUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const postType = params.get('collection_post_type');
    if (postType === 'a' || postType === 'q') {
      return postType;
    }

    if (getPositiveInteger(params.get('article'))) {
      return 'a';
    }

    if (getPositiveInteger(params.get('question'))) {
      return 'q';
    }

    return null;
  }, []);

  const setCollectionStateInUrl = useCallback((collectionId, postMeta = null, replace = false) => {
    const url = new URL(window.location.href);

    if (collectionId) {
      url.searchParams.set('collection', String(collectionId));
    } else {
      url.searchParams.delete('collection');
    }

    if (collectionId && postMeta?.id && postMeta?.type) {
      url.searchParams.set('collection_post', String(postMeta.id));
      url.searchParams.set('collection_post_type', postMeta.type);

      if (postMeta.type === 'a') {
        url.searchParams.set('article', String(postMeta.id));
        url.searchParams.delete('question');
      } else {
        url.searchParams.set('question', String(postMeta.id));
        url.searchParams.delete('article');
      }
    } else {
      url.searchParams.delete('collection_post');
      url.searchParams.delete('collection_post_type');
      url.searchParams.delete('question');
      url.searchParams.delete('article');
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    if (replace) {
      window.history.replaceState(window.history.state, '', nextUrl);
      return;
    }

    window.history.pushState(window.history.state, '', nextUrl);
  }, []);

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
    setCommentDrafts({});
    setCommentErrors({});
    setCollapsedCommentSections({});
    setActiveCommentMenuKey('');
    setEditingCommentKey('');
    setEditingCommentBody('');
    setReplyDrafts({});
    setActiveReplyComposerKey('');
    setShowDeletedTrees({});

    try {
      const detail = await collectionService.getCollectionDetail(collectionId);
      setSelectedCollection(detail);
      setCollections((prev) =>
        prev.map((item) => (item.id === detail.id ? { ...item, views_count: detail.views_count } : item))
      );

      if (updateUrl) {
        setCollectionStateInUrl(collectionId);
      }
    } catch (err) {
      setDetailError(err.response?.data?.error || 'Failed to open collection.');
    } finally {
      setOpeningCollection(false);
    }
  }, [setCollectionStateInUrl]);

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
    setCommentDrafts({});
    setCommentErrors({});
    setCollapsedCommentSections({});
    setActiveCommentMenuKey('');
    setEditingCommentKey('');
    setEditingCommentBody('');
    setReplyDrafts({});
    setActiveReplyComposerKey('');
    setShowDeletedTrees({});

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
          item.id === selectedCollection.id ? { ...item, vote_count: result.vote_count } : item
        )
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
            : item
        )
      );
    } catch (err) {
      setCollectionBookmarkError(err.response?.data?.error || 'Failed to update bookmark.');
    }
  };

  const buildCommentKey = (targetType, targetId) => `${targetType}:${targetId}`;
  const buildCommentItemKey = (targetType, targetId, commentId) => `${targetType}:${targetId}:${commentId}`;

  const getCommentDataForTarget = (serverComments) => {
    const comments = Array.isArray(serverComments) ? serverComments : [];
    const commentById = new Map(comments.map((comment) => [comment.id, comment]));
    const repliesByParentId = {};
    const orphanRepliesByMissingParent = {};

    comments.forEach((comment) => {
      if (!comment.parent_comment) {
        return;
      }

      if (commentById.has(comment.parent_comment)) {
        const list = repliesByParentId[comment.parent_comment] || [];
        repliesByParentId[comment.parent_comment] = [...list, comment];
        return;
      }

      const orphanList = orphanRepliesByMissingParent[comment.parent_comment] || [];
      orphanRepliesByMissingParent[comment.parent_comment] = [...orphanList, comment];
    });

    return {
      roots: comments.filter((comment) => !comment.parent_comment),
      repliesByParentId,
      orphanRepliesByMissingParent,
    };
  };

  const handleCommentDraftChange = (targetType, targetId, value) => {
    const key = buildCommentKey(targetType, targetId);
    setCommentDrafts((prev) => ({
      ...prev,
      [key]: value,
    }));
    setCommentErrors((prev) => ({
      ...prev,
      [key]: '',
    }));
  };

  const updateCommentCollection = (updater) => {
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

  const handleAddComment = async (targetType, targetId) => {
    if (!selectedCollection) {
      return;
    }

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
      const created = await commentService.createComment({
        collection_id: targetId,
        body,
      });

      updateCommentCollection((comments) => [...comments, created]);
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
        [key]: err.response?.data?.error || 'Failed to add comment.',
      }));
    }
  };

  const toggleCommentSection = (targetType, targetId) => {
    const key = buildCommentKey(targetType, targetId);
    setCollapsedCommentSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleCommentMenu = (targetType, targetId, commentId) => {
    const itemKey = buildCommentItemKey(targetType, targetId, commentId);
    setActiveCommentMenuKey((prev) => (prev === itemKey ? '' : itemKey));
  };

  const toggleReplyComposer = (itemKey) => {
    setActiveReplyComposerKey((prev) => (prev === itemKey ? '' : itemKey));
  };

  const handleReplyDraftChange = (itemKey, value) => {
    setReplyDrafts((prev) => ({
      ...prev,
      [itemKey]: value,
    }));
  };

  const handleAddReply = async (targetType, targetId, parentItemKey, parentCommentId, depth) => {
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
      const created = await commentService.createComment({
        parent_comment_id: parentCommentId,
        body,
      });

      updateCommentCollection((comments) => [...comments, created]);
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
        [key]: err.response?.data?.error || 'Failed to add reply.',
      }));
    }
  };

  const handleStartCommentEdit = (targetType, targetId, comment) => {
    setEditingCommentKey(buildCommentItemKey(targetType, targetId, comment.id));
    setEditingCommentBody(comment.body || '');
    setActiveCommentMenuKey('');
    setCommentErrors((prev) => ({
      ...prev,
      [buildCommentKey(targetType, targetId)]: '',
    }));
  };

  const handleSaveCommentEdit = async (targetType, targetId, commentId) => {
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

      updateCommentCollection((comments) =>
        comments.map((comment) => (comment.id === commentId ? { ...comment, ...updated } : comment))
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
        [key]: err.response?.data?.error || 'Failed to update comment.',
      }));
    }
  };

  const handleDeleteComment = async (targetType, targetId, commentId) => {
    const key = buildCommentKey(targetType, targetId);

    try {
      await commentService.deleteComment(commentId);
      updateCommentCollection((comments) => comments.filter((comment) => comment.id !== commentId));
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
        [key]: err.response?.data?.error || 'Failed to delete comment.',
      }));
    }
  };

  const handleCommentUpvote = async (targetType, targetId, commentId) => {
    const key = buildCommentKey(targetType, targetId);
    const comment = (selectedCollection?.comments || []).find((item) => item.id === commentId);
    const currentVote = Number(comment?.current_user_vote || 0);

    try {
      const result =
        currentVote === 1
          ? await voteService.removeVote({ commentId })
          : await voteService.submitVote({ commentId, vote: 1 });

      updateCommentCollection((comments) =>
        comments.map((item) =>
          item.id === commentId
            ? {
                ...item,
                vote_count: result.vote_count,
                current_user_vote: result.vote,
              }
            : item
        )
      );

      setCommentErrors((prev) => ({
        ...prev,
        [key]: '',
      }));
    } catch (err) {
      setCommentErrors((prev) => ({
        ...prev,
        [key]: err.response?.data?.error || 'Failed to vote on comment.',
      }));
    }
  };

  const renderCommentNode = ({ targetType, targetId, comment, depth, repliesByParentId = {} }) => {
    const itemKey = buildCommentItemKey(targetType, targetId, comment.id);
    const isEditing = editingCommentKey === itemKey;
    const isMenuOpen = activeCommentMenuKey === itemKey;
    const canReply = depth < 2;
    const replies = repliesByParentId[comment.id] || [];

    return (
      <li key={comment.id} className="relative border-l-2 border-cyan-300/40 pl-2">
        <div className="min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={editingCommentBody}
                onChange={(e) => setEditingCommentBody(e.target.value)}
                maxLength={280}
                className="h-7 w-full rounded-full border border-white/15 bg-black/20 px-3 text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
              />
              <button
                type="button"
                onClick={() => handleSaveCommentEdit(targetType, targetId, comment.id)}
                className="rounded-full bg-cyan-400 px-2.5 py-1 text-[10px] font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingCommentKey('');
                  setEditingCommentBody('');
                }}
                className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[10px] text-slate-300 transition hover:bg-white/15"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <p className="mt-1 text-[11px] text-slate-400">
                <button
                  type="button"
                  onClick={() => onOpenUserProfile?.(comment.user)}
                  className="font-medium text-slate-300 transition hover:text-cyan-200 hover:underline"
                >
                  {comment.user_name || comment.username || 'User'}
                </button>{' '}
                commented {formatCollectionTime(comment.created_at)}
              </p>
              <p className="text-xs leading-5 text-slate-200 whitespace-pre-wrap">{comment.body}</p>

              <div className="mt-1.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCommentUpvote(targetType, targetId, comment.id)}
                  className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                    Number(comment.current_user_vote || 0) === 1
                      ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100 hover:bg-cyan-400/30'
                      : 'border-white/20 bg-white/5 text-slate-300 hover:bg-white/15'
                  }`}
                >
                  ^ {comment.vote_count || 0}
                </button>

                {canReply ? (
                  <button
                    type="button"
                    onClick={() => toggleReplyComposer(itemKey)}
                    className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300 transition hover:bg-white/15"
                  >
                    Reply
                  </button>
                ) : null}

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => toggleCommentMenu(targetType, targetId, comment.id)}
                    className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300 transition hover:bg-white/15"
                    aria-label="Comment actions"
                  >
                    ...
                  </button>
                  {isMenuOpen ? (
                    <div className="absolute left-0 z-10 mt-1 w-24 overflow-hidden rounded-lg border border-white/15 bg-[#0f141c]">
                      <button
                        type="button"
                        onClick={() => handleStartCommentEdit(targetType, targetId, comment)}
                        className="block w-full px-2.5 py-1.5 text-left text-[11px] text-slate-200 transition hover:bg-white/10"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(targetType, targetId, comment.id)}
                        className="block w-full px-2.5 py-1.5 text-left text-[11px] text-rose-200 transition hover:bg-white/10"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {canReply && activeReplyComposerKey === itemKey ? (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={replyDrafts[itemKey] || ''}
                    onChange={(e) => handleReplyDraftChange(itemKey, e.target.value)}
                    maxLength={280}
                    className="h-7 w-full rounded-full border border-white/15 bg-black/20 px-3 text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                    placeholder="Reply to this comment"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddReply(targetType, targetId, itemKey, comment.id, depth)}
                    className="rounded-full bg-cyan-400 px-2.5 py-1 text-[10px] font-semibold text-slate-950 transition hover:bg-cyan-300"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveReplyComposerKey('')}
                    className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[10px] text-slate-300 transition hover:bg-white/15"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>

        {replies.length > 0 ? (
          <ul className="mt-2 ml-3 space-y-1.5">
            {replies.map((reply) =>
              renderCommentNode({
                targetType,
                targetId,
                comment: reply,
                depth: depth + 1,
                repliesByParentId,
              })
            )}
          </ul>
        ) : null}
      </li>
    );
  };

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

  useEffect(() => {
    const syncFromUrl = async () => {
      if (!team?.id) {
        return;
      }

      const urlCollectionId = getCollectionIdFromUrl();
      if (!urlCollectionId) {
        if (selectedCollection) {
          setSelectedCollection(null);
          setSelectedCollectionPost(null);
          setCollectionPostCards({});
          setDetailError('');
          setCollectionPostError('');
          setSearchError('');
          setCollectionBookmarkError('');
          setPostSearchTerm('');
          setPostSearchResults([]);
          setCommentDrafts({});
          setCommentErrors({});
          setCollapsedCommentSections({});
          setActiveCommentMenuKey('');
          setEditingCommentKey('');
          setEditingCommentBody('');
          setReplyDrafts({});
          setActiveReplyComposerKey('');
          setShowDeletedTrees({});
        }
        return;
      }

      if (selectedCollection?.id !== urlCollectionId) {
        await openCollection(urlCollectionId, false);
        return;
      }

      const urlCollectionPostId = getCollectionPostIdFromUrl();
      const urlCollectionPostType = getCollectionPostTypeFromUrl();
      if (!urlCollectionPostId) {
        if (selectedCollectionPost) {
          setSelectedCollectionPost(null);
          setCollectionPostError('');
        }
        return;
      }

      if (selectedCollectionPost?.post_id === urlCollectionPostId) {
        return;
      }

      const refFromCollection = (selectedCollection.posts || []).find(
        (item) => Number(item.post_id) === urlCollectionPostId
      );

      const fallbackRef = {
        post_id: urlCollectionPostId,
        type: urlCollectionPostType === 'a' ? 22 : 0,
      };

      await openCollectionPost(refFromCollection || fallbackRef, false);
    };

    syncFromUrl();

    const onPopState = () => {
      syncFromUrl();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [
    team?.id,
    selectedCollection,
    selectedCollectionPost,
    getCollectionIdFromUrl,
    getCollectionPostIdFromUrl,
    getCollectionPostTypeFromUrl,
    openCollection,
    openCollectionPost,
  ]);

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
        prev.map((item) => (item.id === postId ? { ...item, already_added: true } : item))
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

  return (
    /* Collection tab header */
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {selectedCollection ? (
            <button
              type="button"
              onClick={handleBackToCollections}
              className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/20"
            >
              Back
            </button>
          ) : null}

          <div>
            <h2 className="text-2xl font-semibold text-white">Collections</h2>
            {!selectedCollection ? (
              <p className="mt-2 text-slate-300">
                Curated lists of questions, answers, and articles for your team.
              </p>
            ) : null}
          </div>
        </div>

        {!selectedCollection && isTeamAdmin ? (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="rounded-full bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Create new collection
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {loading ? <p className="mt-6 text-slate-300">Loading collections...</p> : null}
      {!selectedCollection && openingCollection ? <p className="mt-6 text-slate-300">Opening collection...</p> : null}

      {selectedCollection ? (
        <div className="mt-6 w-full rounded-3xl border border-white/10 bg-[#111821] p-6 shadow-2xl shadow-black/35 sm:p-8">
          <div className="mb-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-2xl font-semibold text-white">{selectedCollection.title}</h3>
            </div>

            {/* Collection detail view */}
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1">
                Created: {formatCollectionTime(selectedCollection.created_at)}
              </span>
              <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1">
                {selectedCollection.views_count || 0} views
              </span>
              <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1">
                {selectedCollection.post_count || (selectedCollection.posts || []).length || 0} posts
              </span>
            </div>

            {/* Collection voting component */ }
            {!selectedCollectionPost ? (
              <div className="mt-2 flex items-start gap-2">
                <div className="flex shrink-0 flex-col items-center gap-1 rounded-xl border border-white/0 bg-black/30 px-2 py-2">
                  <button
                    type="button"
                    onClick={handleCollectionUpvote}
                    disabled={votingCollection}
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition ${
                      Number(selectedCollection.current_user_vote || 0) === 1
                        ? 'border-cyan-300/30 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-400/30'
                        : 'border-white/10 bg-white/10 text-slate-200 hover:bg-white/15'
                    } ${votingCollection ? 'cursor-not-allowed opacity-70' : ''}`}
                    aria-label="Upvote collection"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
                      <path d="m6 14 6-6 6 6" />
                    </svg>
                  </button>
                  <span className="min-w-[2ch] text-center text-sm font-semibold text-cyan-100">
                    {selectedCollection.vote_count || 0}
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleCollectionBookmark}
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition ${
                      selectedCollection.is_bookmarked
                        ? 'border-amber-300/30 bg-amber-500/20 text-amber-100 hover:bg-amber-400/30'
                        : 'border-white/10 bg-white/10 text-slate-200 hover:bg-white/15'
                    }`}
                    aria-label="Bookmark collection"
                  >
                    <svg viewBox="0 0 24 24" fill={selectedCollection.is_bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
                      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
                    </svg>
                  </button>
                  <span className="min-w-[2ch] text-center text-[11px] font-semibold text-amber-100">
                    {selectedCollection.bookmarks_count || 0}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  {/* Collection description */ }
                  <div className="rounded-2xl border border-white/0 bg-white/5 px-3 py-2">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">
                      {selectedCollection.description || 'No description provided.'}
                    </p>
                  </div>

                  <CommentSection
                    targetType="collection"
                    targetId={selectedCollection.id}
                    commentsCount={(selectedCollection.comments || []).length}
                    commentData={collectionCommentData}
                    collapsed={Boolean(collapsedCommentSections[buildCommentKey('collection', selectedCollection.id)])}
                    onToggleCollapsed={() => toggleCommentSection('collection', selectedCollection.id)}
                    draftValue={commentDrafts[buildCommentKey('collection', selectedCollection.id)] || ''}
                    onDraftChange={(value) => handleCommentDraftChange('collection', selectedCollection.id, value)}
                    onAddComment={() => handleAddComment('collection', selectedCollection.id)}
                    errorMessage={commentErrors[buildCommentKey('collection', selectedCollection.id)]}
                    showDeletedTree={Boolean(showDeletedTrees[buildCommentKey('collection', selectedCollection.id)])}
                    onShowDeletedTree={() =>
                      setShowDeletedTrees((prev) => ({
                        ...prev,
                        [buildCommentKey('collection', selectedCollection.id)]: true,
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
                    onCancelCommentEdit={() => {
                      setEditingCommentKey('');
                      setEditingCommentBody('');
                    }}
                    onCancelReplyComposer={() => setActiveReplyComposerKey('')}
                    onOpenUserProfile={onOpenUserProfile}
                    formatTime={formatCollectionTime}
                    getCommentKey={buildCommentKey}
                    getCommentItemKey={buildCommentItemKey}
                  />

                  {collectionVoteError ? (
                    <p className="mt-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-200">
                      {collectionVoteError}
                    </p>
                  ) : null}

                  {collectionBookmarkError ? (
                      <p className="mt-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-200">
                        {collectionBookmarkError}
                      </p>
                    ) : null}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{selectedCollection.description || 'No description provided.'}</p>
            )}
          </div>

          {!selectedCollectionPost ? (
            <>
              <div className="mt-3 border-t border-white/15" />

              <div className="mt-2">
                {isTeamAdmin ? (
                  <>
                    <h4 className="text-sm font-semibold tracking-[0.08em] text-slate-300 uppercase">Add posts</h4>

                    <input
                      type="text"
                      value={postSearchTerm}
                      onChange={(e) => setPostSearchTerm(e.target.value)}
                      className="mt-2 h-10 w-full rounded-full border border-white/10 bg-black/20 px-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                      placeholder="Search questions and articles by title"
                    />

                    {searchingPosts ? <p className="mt-2 text-xs text-slate-300">Searching posts...</p> : null}
                    {searchError ? (
                      <p className="mt-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-200">
                        {searchError}
                      </p>
                    ) : null}

                    {postSearchResults.length > 0 ? (
                      <ul className="mt-3 space-y-2">
                        {postSearchResults.map((post) => (
                          <li key={post.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-100">{post.title}</p>
                                <p className="mt-0.5 text-xs text-slate-400">{getPostTypeLabel(post)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddPost(post.id)}
                                disabled={post.already_added || addingPostId === post.id}
                                className="rounded-full bg-cyan-400 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {post.already_added ? 'Added' : addingPostId === post.id ? 'Adding...' : 'Add'}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : (
                  <p className="rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs text-slate-300">
                    Only admins can add posts to this collection.
                  </p>
                )}
              </div>

              {/* Collection posts list */}
              <div className="mt-5">
                <h4 className="text-sm font-semibold tracking-[0.08em] text-slate-300 uppercase">
                  Posts ({(selectedCollection.posts || []).length})
                </h4>

                {(selectedCollection.posts || []).length > 0 ? (
                  <ol className="mt-3 space-y-3">
                    {(selectedCollection.posts || []).map((postRef) => {
                      const card = collectionPostCards[Number(postRef.post_id)] || postRef;
                      const articleCard = isArticlePost(postRef);

                      if (articleCard) {
                        return (
                          <li key={`${postRef.post_id}-${postRef.sequence_number}`}>
                            <button
                              type="button"
                              onClick={() => openCollectionPost(postRef, true)}
                              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left transition"
                            >
                              <div className="flex items-center gap-2">
                                <span className="rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                                  {card.type_label || getPostTypeLabel(card)}
                                </span>
                                <span className="rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                                  {card.views_count || 0} views
                                </span>
                              </div>
                              <h3 className="mt-2 text-base font-semibold text-slate-100">{card.title}</h3>
                              <p
                                className="mt-1 text-sm text-slate-300"
                                style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {card.body || ''}
                              </p>

                              <div className="mt-2 flex items-center justify-between gap-3">
                                <div className="min-w-0 flex flex-wrap gap-2">
                                  {(card.tags || []).map((tag) => (
                                    <span
                                      key={tag.id || tag.name}
                                      className="rounded-sm border border-cyan-300/0 bg-cyan-300/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-400"
                                    >
                                      {tag.name}
                                    </span>
                                  ))}
                                </div>
                                <span className="shrink-0 text-xs text-slate-400">
                                  <button
                                    type="button"
                                    onClick={() => onOpenUserProfile?.(card.user_id || card.user)}
                                    className="font-medium text-slate-300 transition hover:text-cyan-200 hover:underline"
                                  >
                                    {card.user_name}
                                  </button>{' '}
                                  created {formatCollectionTime(card.created_at)}
                                </span>
                              </div>
                            </button>
                          </li>
                        );
                      }

                      return (
                        <li key={`${postRef.post_id}-${postRef.sequence_number}`}>
                          <button
                            type="button"
                            onClick={() => openCollectionPost(postRef, true)}
                            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left text-slate-100"
                          >
                            <div className="mb-2 flex items-center gap-2">
                              <span
                                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                                  card.approved_answer
                                    ? 'border-emerald-300/0 bg-emerald-400/20 text-emerald-300'
                                    : 'border-white/0 bg-white/10 text-slate-300'
                                }`}
                              >
                                {card.answer_count || 0} answers
                              </span>
                              <span className="rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                                {card.views_count || 0} views
                              </span>
                            </div>
                            <div className="flex items-start justify-between gap-4">
                              <p className="font-medium text-slate-100">{card.title}</p>
                            </div>
                            <div className="flex items-start justify-between gap-4">
                              <p
                                className="mt-1 text-sm text-slate-300"
                                style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {card.body || ''}
                              </p>
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-4">
                              <div className="min-w-0 flex flex-wrap gap-2">
                                {(card.tags || []).map((tag) => (
                                  <span
                                    key={tag.id || tag.name}
                                    className="rounded-sm border border-cyan-300/0 bg-cyan-300/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-400"
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                              </div>
                              <p className="shrink-0 text-right text-xs text-slate-400">
                                <span>
                                  <button
                                    type="button"
                                    onClick={() => onOpenUserProfile?.(card.user_id || card.user)}
                                    className="font-medium text-slate-300 transition hover:text-cyan-200 hover:underline"
                                  >
                                    {card.user_name}
                                  </button>{' '}
                                  asked {formatCollectionTime(card.created_at)}
                                </span>
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">No posts added yet.</p>
                )}
              </div>
            </>
          ) : (
            <div className="mt-2">
              <div className="mb-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBackToCollectionPosts}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/20"
                >
                  Back to posts
                </button>
                {openingCollectionPost ? <span className="text-xs text-slate-300">Opening post...</span> : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-2 py-2 sm:px-3 sm:py-3">
                {selectedCollectionPost.is_article ? (
                  <ArticlesTab
                    key={`collection-article-${selectedCollectionPost.post_id}`}
                    team={team}
                    embeddedMode
                    onOpenUserProfile={onOpenUserProfile}
                  />
                ) : (
                  <QuestionTab
                    key={`collection-question-${selectedCollectionPost.post_id}`}
                    team={team}
                    embeddedMode
                    onOpenUserProfile={onOpenUserProfile}
                  />
                )}
              </div>
            </div>
          )}

          {detailError ? (
            <p className="mt-3 rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
              {detailError}
            </p>
          ) : null}

          {collectionPostError ? (
            <p className="mt-3 rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
              {collectionPostError}
            </p>
          ) : null}
        </div>
      ) : null}

      {!loading && !selectedCollection && collections.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-10 text-center text-slate-400">
          No collections created yet.
        </div>
      ) : null}

      {!loading && !selectedCollection && collections.length > 0 ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => (
            <li key={collection.id}>
              <div className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                      {collection.views_count || 0} views
                    </span>
                    <span className="shrink-0 rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                      {collection.post_count || 0} posts
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">{formatCollectionTime(collection.created_at)}</span>
                </div>

                <button
                  type="button"
                  onClick={() => openCollection(collection.id, true)}
                  className="mt-2 text-left text-base font-semibold text-slate-100 transition hover:text-cyan-200 hover:underline"
                >
                  {collection.title}
                </button>
                <p className="mt-1 text-sm text-slate-300 whitespace-pre-wrap">{collection.description || 'No description provided.'}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-[#111821] p-6 shadow-2xl shadow-black/50 sm:p-8">
            <h3 className="text-2xl font-semibold text-white">Create new collection</h3>

            <form onSubmit={handleCreateCollection} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-full border border-white/15 bg-black/20 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                  placeholder="Collection title"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[160px] w-full rounded-3xl border border-white/15 bg-black/20 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                  placeholder="Describe this collection"
                />
              </div>

              {formError ? (
                <p className="rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
                  {formError}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/20"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Creating...' : 'Create collection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CollectionsTab;
