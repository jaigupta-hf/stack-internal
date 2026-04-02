import { useCallback, useEffect, useMemo, useState } from 'react';
import { commentService, postService, tagService, voteService } from '../../services/api';
import CommentSection, { buildCommentData, EMPTY_COMMENT_DATA } from '../../components/CommentSection';
import VotePanel from '../../components/VotePanel';
import TagPreferencesPanel from '../../components/TagPreferencesPanel';
import PostComposerModal from '../../components/PostComposerModal';
import { formatRelativeTimestamp, formatVerboseRelativeTime } from '../../utils/dateTime';

const ARTICLE_TYPE_OPTIONS = [
  { label: 'Knowledge article', value: 22 },
  { label: 'Announcement', value: 20 },
  { label: 'How-to guide', value: 21 },
  { label: 'Policy', value: 23 },
];

const formatArticleTime = (timestamp) => formatRelativeTimestamp(timestamp, { dateOnlyAfterDay: true });

const formatArticleListTime = (timestamp) => formatRelativeTimestamp(timestamp);

function ArticlesTab({ team, embeddedMode = false, onOpenUserProfile }) {
  const [openingArticle, setOpeningArticle] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [articleVoteError, setArticleVoteError] = useState('');
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentErrors, setCommentErrors] = useState({});
  const [collapsedCommentSections, setCollapsedCommentSections] = useState({});
  const [activeCommentMenuKey, setActiveCommentMenuKey] = useState('');
  const [editingCommentKey, setEditingCommentKey] = useState('');
  const [editingCommentBody, setEditingCommentBody] = useState('');
  const [replyDrafts, setReplyDrafts] = useState({});
  const [activeReplyComposerKey, setActiveReplyComposerKey] = useState('');
  const [showDeletedTrees, setShowDeletedTrees] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [articleType, setArticleType] = useState(22);
  const [body, setBody] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [articleTags, setArticleTags] = useState([]);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [searchingTags, setSearchingTags] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [tagError, setTagError] = useState('');
  const [isEditingArticle, setIsEditingArticle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editArticleType, setEditArticleType] = useState(22);
  const [editBody, setEditBody] = useState('');
  const [editTagInput, setEditTagInput] = useState('');
  const [editTags, setEditTags] = useState([]);
  const [editTagSuggestions, setEditTagSuggestions] = useState([]);
  const [searchingEditTags, setSearchingEditTags] = useState(false);
  const [editError, setEditError] = useState('');
  const [editTagError, setEditTagError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tagPreferences, setTagPreferences] = useState([]);
  const [loadingTagPreferences, setLoadingTagPreferences] = useState(false);
  const [tagPreferenceError, setTagPreferenceError] = useState('');
  const [updatingTagPreferenceKey, setUpdatingTagPreferenceKey] = useState('');
  const [allTeamTags, setAllTeamTags] = useState([]);
  const [watchTagInput, setWatchTagInput] = useState('');
  const [ignoreTagInput, setIgnoreTagInput] = useState('');
  const [selectedArticleTagFilter, setSelectedArticleTagFilter] = useState('');

  const getArticleIdFromUrl = useCallback(() => {
    const value = new URLSearchParams(window.location.search).get('article');
    if (!value) {
      return null;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, []);

  const setArticleIdInUrl = useCallback((articleId, replace = false) => {
    const url = new URL(window.location.href);
    if (articleId) {
      url.searchParams.set('article', String(articleId));
    } else {
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
    const loadArticles = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await postService.listArticles(team.id);
        setArticles(data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load articles.');
      } finally {
        setLoading(false);
      }
    };

    loadArticles();
  }, [team.id]);

  useEffect(() => {
    const loadTagPreferences = async () => {
      if (!team?.id) {
        setTagPreferences([]);
        return;
      }

      setLoadingTagPreferences(true);
      setTagPreferenceError('');

      try {
        const data = await tagService.listPreferences(team.id);
        setTagPreferences(data || []);
      } catch (err) {
        setTagPreferences([]);
        setTagPreferenceError(err.response?.data?.error || 'Failed to load tag preferences.');
      } finally {
        setLoadingTagPreferences(false);
      }
    };

    loadTagPreferences();
  }, [team?.id]);

  useEffect(() => {
    const loadAllTags = async () => {
      if (!team?.id) {
        setAllTeamTags([]);
        return;
      }

      try {
        const data = await tagService.listTags(team.id);
        setAllTeamTags(data || []);
      } catch {
        setAllTeamTags([]);
      }
    };

    loadAllTags();
  }, [team?.id]);

  useEffect(() => {
    setSelectedArticle(null);
    setCommentDrafts({});
    setCommentErrors({});
    setCollapsedCommentSections({});
    setActiveCommentMenuKey('');
    setEditingCommentKey('');
    setEditingCommentBody('');
    setReplyDrafts({});
    setActiveReplyComposerKey('');
    setShowDeletedTrees({});
    setArticleVoteError('');
    setIsEditingArticle(false);
    setEditError('');
    setEditTagError('');
  }, [team.id]);

  useEffect(() => {
    if (!showCreateModal) {
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
        const selected = new Set(articleTags.map((tag) => tag.toLowerCase()));
        setTagSuggestions(matches.filter((tag) => !selected.has(tag.name.toLowerCase())));
      } catch (_err) {
        setTagSuggestions([]);
      } finally {
        setSearchingTags(false);
      }
    }, 250);

    return () => clearTimeout(debounce);
  }, [showCreateModal, tagInput, articleTags]);

  useEffect(() => {
    if (!isEditingArticle) {
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
        const selected = new Set(editTags.map((tag) => tag.toLowerCase()));
        setEditTagSuggestions(matches.filter((tag) => !selected.has(tag.name.toLowerCase())));
      } catch (_err) {
        setEditTagSuggestions([]);
      } finally {
        setSearchingEditTags(false);
      }
    }, 250);

    return () => clearTimeout(debounce);
  }, [isEditingArticle, editTagInput, editTags]);

  const normalizeTagName = (value) => value.toLowerCase().replace(/[^a-z0-9-]/g, '').trim();
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
    setArticleTags((prev) => {
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
    setArticleTags((prev) => prev.filter((tag) => tag !== tagToRemove));
    setTagError('');
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
    setEditTags((prev) => {
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
    setEditTags((prev) => prev.filter((tag) => tag !== tagToRemove));
    setEditTagError('');
  };

  const resetCreateForm = () => {
    setTitle('');
    setArticleType(22);
    setBody('');
    setTagInput('');
    setArticleTags([]);
    setTagSuggestions([]);
    setFormError('');
    setTagError('');
  };

  const handleCreateArticle = async (e) => {
    e.preventDefault();
    setFormError('');
    setTagError('');

    const tagsForSubmit = [...articleTags];
    const pendingTag = normalizeTagName(tagInput);
    if (pendingTag) {
      if (isNumericOnlyTag(pendingTag)) {
        setTagError('Tag name cannot contain only numbers.');
        return;
      }

      const exists = tagsForSubmit.some((tag) => tag.toLowerCase() === pendingTag.toLowerCase());
      if (!exists && tagsForSubmit.length >= 5) {
        setTagError('Maximum 5 tags are allowed.');
        return;
      }
      if (!exists) {
        tagsForSubmit.push(pendingTag);
      }
    }

    if (tagsForSubmit.length < 1) {
      setTagError('At least 1 tag is required.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await postService.createArticle({
        team_id: team.id,
        title,
        type: articleType,
        body,
        tags: tagsForSubmit,
      });

      setArticles((prev) => [created, ...prev]);
      resetCreateForm();
      setShowCreateModal(false);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create article.');
    } finally {
      setSubmitting(false);
    }
  };

  const typeLabelByCode = useMemo(() => {
    const map = {};
    ARTICLE_TYPE_OPTIONS.forEach((item) => {
      map[item.value] = item.label;
    });
    return map;
  }, []);

  const watchingTags = useMemo(
    () => (tagPreferences || []).filter((tag) => tag.is_watching),
    [tagPreferences]
  );

  const ignoredTags = useMemo(
    () => (tagPreferences || []).filter((tag) => tag.is_ignored),
    [tagPreferences]
  );

  const watchSuggestions = useMemo(() => {
    const query = watchTagInput.trim().toLowerCase();
    if (!query) {
      return [];
    }

    const excluded = new Set(watchingTags.map((tag) => tag.tag_id));
    return (allTeamTags || [])
      .filter((tag) => !excluded.has(tag.id) && (tag.name || '').toLowerCase().includes(query))
      .slice(0, 8);
  }, [allTeamTags, watchingTags, watchTagInput]);

  const ignoreSuggestions = useMemo(() => {
    const query = ignoreTagInput.trim().toLowerCase();
    if (!query) {
      return [];
    }

    const excluded = new Set(ignoredTags.map((tag) => tag.tag_id));
    return (allTeamTags || [])
      .filter((tag) => !excluded.has(tag.id) && (tag.name || '').toLowerCase().includes(query))
      .slice(0, 8);
  }, [allTeamTags, ignoredTags, ignoreTagInput]);

  const watchedTagIdSet = useMemo(
    () => new Set(watchingTags.map((tag) => Number(tag.tag_id))),
    [watchingTags]
  );

  const watchedTagNameSet = useMemo(
    () => new Set(watchingTags.map((tag) => String(tag.tag_name || '').toLowerCase())),
    [watchingTags]
  );

  const ignoredTagIdSet = useMemo(
    () => new Set(ignoredTags.map((tag) => Number(tag.tag_id))),
    [ignoredTags]
  );

  const ignoredTagNameSet = useMemo(
    () => new Set(ignoredTags.map((tag) => String(tag.tag_name || '').toLowerCase())),
    [ignoredTags]
  );

  const visibleArticles = useMemo(() => {
    if (!selectedArticleTagFilter) {
      return articles;
    }

    const selectedTag = selectedArticleTagFilter.toLowerCase();
    return (articles || []).filter((article) =>
      (article.tags || []).some((tag) => String(tag.name || '').toLowerCase() === selectedTag)
    );
  }, [articles, selectedArticleTagFilter]);

  const articleTagCounts = useMemo(() => {
    const counts = new Map();

    (articles || []).forEach((article) => {
      (article.tags || []).forEach((tag) => {
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
  }, [articles]);

  const handleApplyArticleTagFilter = (tagName) => {
    if (!tagName) {
      return;
    }

    setSelectedArticleTagFilter(tagName);
    if (selectedArticle) {
      handleBackToArticleList();
    }
  };

  const upsertTagPreference = (updated) => {
    setTagPreferences((prev) => {
      const existing = (prev || []).find((item) => item.tag_id === updated.tag_id);
      if (existing) {
        return (prev || []).map((item) =>
          item.tag_id === updated.tag_id
            ? {
                ...item,
                tag_name: updated.tag_name || item.tag_name,
                count: updated.count ?? item.count,
                is_watching: updated.is_watching,
                is_ignored: updated.is_ignored,
              }
            : item
        );
      }

      return [
        {
          tag_id: updated.tag_id,
          tag_name: updated.tag_name,
          count: updated.count ?? 0,
          is_watching: updated.is_watching,
          is_ignored: updated.is_ignored,
        },
        ...(prev || []),
      ];
    });
  };

  const handleSetTagPreference = async ({ tagId, field, value }) => {
    if (!team?.id) {
      return;
    }

    const requestKey = `${field}:${tagId}`;
    setUpdatingTagPreferenceKey(requestKey);
    setTagPreferenceError('');

    try {
      const updated = await tagService.updatePreference({
        teamId: team.id,
        tagId,
        field,
        value,
      });
      upsertTagPreference(updated);
    } catch (err) {
      setTagPreferenceError(err.response?.data?.error || 'Failed to update tag preference.');
    } finally {
      setUpdatingTagPreferenceKey('');
    }
  };

  const openArticle = useCallback(async (articleId, updateUrl = false) => {
    setOpeningArticle(true);
    setError('');
    setCommentErrors({});
    setArticleVoteError('');

    try {
      const data = await postService.getArticleDetail(articleId);
      setArticles((prev) =>
        prev.map((item) =>
          item.id === articleId
            ? {
                ...item,
                views_count: data.views_count,
                vote_count: data.vote_count,
                current_user_vote: data.current_user_vote,
                is_bookmarked: data.is_bookmarked,
                bookmarks_count: data.bookmarks_count,
              }
            : item
        )
      );
      setSelectedArticle(data);
      setIsEditingArticle(false);
      setEditError('');
      setEditTagError('');
      if (updateUrl) {
        setArticleIdInUrl(articleId);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to open article.');
    } finally {
      setOpeningArticle(false);
    }
  }, [setArticleIdInUrl]);

  const handleStartArticleEdit = () => {
    if (!selectedArticle) {
      return;
    }

    setEditTitle(selectedArticle.title || '');
    setEditBody(selectedArticle.body || '');
    setEditArticleType(Number(selectedArticle.type) || 22);
    setEditTags((selectedArticle.tags || []).map((tag) => tag.name));
    setEditTagInput('');
    setEditTagSuggestions([]);
    setEditError('');
    setEditTagError('');
    setIsEditingArticle(true);
  };

  const handleCancelArticleEdit = () => {
    setIsEditingArticle(false);
    setEditTagInput('');
    setEditTagSuggestions([]);
    setEditError('');
    setEditTagError('');
  };

  const handleSaveArticleEdit = async () => {
    if (!selectedArticle) {
      return;
    }

    setEditError('');
    setEditTagError('');

    const tagsForSubmit = [...editTags];
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

    if (tagsForSubmit.length < 1) {
      setEditTagError('At least 1 tag is required.');
      return;
    }

    setSavingEdit(true);
    try {
      const updated = await postService.updateArticle(selectedArticle.id, {
        title: editTitle,
        type: editArticleType,
        body: editBody,
        tags: tagsForSubmit,
      });

      setSelectedArticle((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          ...updated,
          comments: prev.comments || [],
          vote_count: prev.vote_count,
          current_user_vote: prev.current_user_vote,
        };
      });

      setArticles((prev) =>
        prev.map((item) =>
          item.id === selectedArticle.id
            ? {
                ...item,
                title: updated.title,
                body: updated.body,
                type: updated.type,
                type_label: updated.type_label,
                tags: updated.tags || [],
              }
            : item
        )
      );

      setIsEditingArticle(false);
      setEditTagInput('');
      setEditTagSuggestions([]);
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update article.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleBackToArticleList = useCallback(() => {
    if (getArticleIdFromUrl()) {
      setArticleIdInUrl(null, true);
    }

    setSelectedArticle(null);
    setCommentDrafts({});
    setCommentErrors({});
    setCollapsedCommentSections({});
    setActiveCommentMenuKey('');
    setEditingCommentKey('');
    setEditingCommentBody('');
    setReplyDrafts({});
    setActiveReplyComposerKey('');
    setShowDeletedTrees({});
    setArticleVoteError('');
    setIsEditingArticle(false);
    setEditError('');
    setEditTagError('');
  }, [getArticleIdFromUrl, setArticleIdInUrl]);

  useEffect(() => {
    const syncFromUrl = async () => {
      const urlArticleId = getArticleIdFromUrl();

      if (!urlArticleId) {
        if (selectedArticle) {
          setSelectedArticle(null);
          setCommentDrafts({});
          setCommentErrors({});
          setCollapsedCommentSections({});
          setActiveCommentMenuKey('');
          setEditingCommentKey('');
          setEditingCommentBody('');
          setReplyDrafts({});
          setActiveReplyComposerKey('');
          setShowDeletedTrees({});
          setArticleVoteError('');
        }
        return;
      }

      if (selectedArticle?.id === urlArticleId) {
        return;
      }

      await openArticle(urlArticleId, false);
    };

    syncFromUrl();

    const onPopState = () => {
      syncFromUrl();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [team.id, selectedArticle, getArticleIdFromUrl, openArticle]);

  const handleArticleUpvote = async () => {
    if (!selectedArticle) {
      return;
    }

    const currentVote = Number(selectedArticle.current_user_vote || 0);
    try {
      setArticleVoteError('');
      const result =
        currentVote === 1
          ? await voteService.removeVote({ postId: selectedArticle.id })
          : await voteService.submitVote({ postId: selectedArticle.id, vote: 1 });

      setSelectedArticle((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          vote_count: result.vote_count,
          current_user_vote: result.vote,
        };
      });

      setArticles((prev) =>
        prev.map((item) =>
          item.id === selectedArticle.id
            ? {
                ...item,
                vote_count: result.vote_count,
                current_user_vote: result.vote,
              }
            : item
        )
      );
    } catch (err) {
      setArticleVoteError(err.response?.data?.error || 'Failed to vote on article.');
    }
  };

  const handleListArticleUpvote = async (articleId) => {
    const article = articles.find((item) => item.id === articleId);
    if (!article) {
      return;
    }

    const currentVote = Number(article.current_user_vote || 0);

    try {
      setError('');
      const result =
        currentVote === 1
          ? await voteService.removeVote({ postId: articleId })
          : await voteService.submitVote({ postId: articleId, vote: 1 });

      setArticles((prev) =>
        prev.map((item) =>
          item.id === articleId
            ? {
                ...item,
                vote_count: result.vote_count,
                current_user_vote: result.vote,
              }
            : item
        )
      );

      setSelectedArticle((prev) =>
        prev && prev.id === articleId
          ? {
              ...prev,
              vote_count: result.vote_count,
              current_user_vote: result.vote,
            }
          : prev
      );
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to vote on article.');
    }
  };

  const handleToggleArticleBookmark = async (articleId) => {
    const article = articles.find((item) => item.id === articleId);
    const isBookmarked = article?.is_bookmarked || (selectedArticle?.id === articleId && selectedArticle.is_bookmarked);

    try {
      setError('');
      if (isBookmarked) {
        await postService.removeBookmark({ postId: articleId });
      } else {
        await postService.addBookmark({ post_id: articleId });
      }

      setArticles((prev) =>
        prev.map((item) =>
          item.id === articleId
            ? {
                ...item,
                is_bookmarked: !isBookmarked,
                bookmarks_count: Math.max((item.bookmarks_count || 0) + (isBookmarked ? -1 : 1), 0),
              }
            : item
        )
      );

      setSelectedArticle((prev) =>
        prev && prev.id === articleId
          ? {
              ...prev,
              is_bookmarked: !isBookmarked,
              bookmarks_count: Math.max((prev.bookmarks_count || 0) + (isBookmarked ? -1 : 1), 0),
            }
          : prev
      );
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update bookmark.');
    }
  };

  const buildCommentKey = (targetType, targetId) => `${targetType}:${targetId}`;
  const buildCommentItemKey = (targetType, targetId, commentId) => `${targetType}:${targetId}:${commentId}`;

  const getCommentDataForTarget = (targetType, targetId, serverComments) => {
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

  const handleAddComment = async (targetType, targetId, postId) => {
    if (!selectedArticle) {
      return;
    }

    const key = buildCommentKey(targetType, targetId);
    const bodyValue = (commentDrafts[key] || '').trim();
    if (!bodyValue) {
      setCommentErrors((prev) => ({
        ...prev,
        [key]: 'Comment cannot be empty.',
      }));
      return;
    }

    try {
      const created = await commentService.createComment({
        post_id: postId,
        body: bodyValue,
      });

      updateCommentCollection(targetType, targetId, (comments) => [...comments, { ...created, current_user_vote: 0 }]);
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
    const bodyValue = (replyDrafts[parentItemKey] || '').trim();

    if (!bodyValue) {
      setCommentErrors((prev) => ({
        ...prev,
        [key]: 'Reply cannot be empty.',
      }));
      return;
    }

    try {
      const created = await commentService.createComment({
        parent_comment_id: parentCommentId,
        body: bodyValue,
      });

      updateCommentCollection(targetType, targetId, (comments) => [...comments, { ...created, current_user_vote: 0 }]);
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

      updateCommentCollection(targetType, targetId, (comments) =>
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
      updateCommentCollection(targetType, targetId, (comments) => comments.filter((comment) => comment.id !== commentId));
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
    const comments = targetType === 'article' ? selectedArticle?.comments || [] : [];
    const comment = comments.find((item) => item.id === commentId);
    const currentVote = Number(comment?.current_user_vote || 0);

    try {
      const result =
        currentVote === 1
          ? await voteService.removeVote({ commentId })
          : await voteService.submitVote({ commentId, vote: 1 });

      updateCommentCollection(targetType, targetId, (nextComments) =>
        nextComments.map((item) =>
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
                commented {formatArticleTime(comment.created_at)}
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

  const articleCommentData = selectedArticle
    ? buildCommentData(selectedArticle.comments)
    : EMPTY_COMMENT_DATA;

  return (

    /* Article tab header */
    <div>
      {!embeddedMode ? (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {selectedArticle ? (
            <button
              type="button"
              onClick={handleBackToArticleList}
              className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/20"
            >
              Back
            </button>
          ) : null}

          <div>
          <h2 className="text-2xl font-semibold text-white">Articles</h2>
          <p className="mt-1 text-slate-300">
            {selectedArticle
              ? null
              : 'Share long-form, official documentation and knowledge for your team.'}
          </p>

          {!selectedArticle && selectedArticleTagFilter ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-300/0 bg-cyan-300/15 px-3 py-0.5 text-xs text-cyan-100">
                Tag: {selectedArticleTagFilter}
              </span>
              <button
                type="button"
                onClick={() => setSelectedArticleTagFilter('')}
                className="rounded-full border border-white/0 bg-white/10 px-3 py-0.5 text-xs text-slate-300 transition hover:bg-white/20"
              >
                Clear tag filter
              </button>
            </div>
          ) : null}
          </div>
        </div>

        {!selectedArticle ? (
          <button
            type="button"
            onClick={() => {
              resetCreateForm();
              setShowCreateModal(true);
            }}
            className="rounded-full bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Create a new articles
          </button>
        ) : null}
      </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {loading ? <p className="mt-6 text-slate-300">Loading articles...</p> : null}
      {openingArticle ? <p className="mt-6 text-slate-300">Opening article...</p> : null}

      {!embeddedMode && !loading && articles.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-10 text-center text-slate-400">
          No articles posted yet.
        </div>
      ) : null}

      {!embeddedMode && !loading && articles.length > 0 && visibleArticles.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-10 text-center text-slate-400">
          No articles match this filter.
        </div>
      ) : null}

      {/* Article detail view */ }
      {!loading && selectedArticle ? (
        <div className="mt-6 w-full rounded-3xl border border-white/10 bg-[#111821] p-6 shadow-2xl shadow-black/35 sm:p-8">
          <div className="mb-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-2xl font-semibold text-white">{selectedArticle.title}</h3>
            </div>

            <div className="mt-2 flex items-start gap-3">
              <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1">
                  Type: {selectedArticle.type_label || typeLabelByCode[selectedArticle.type] || 'Article'}
                </span>
                <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1">
                  Published: {formatVerboseRelativeTime(selectedArticle.created_at)}
                </span>
                <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1">
                  {selectedArticle.views_count || 0} views
                </span>
              </div>
            </div>
            <div className="mt-3 border-t border-white/15" />
          </div>

          {/* Article editing */}
          {isEditingArticle ? (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-full border border-white/15 bg-black/20 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                  placeholder="Article title"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200">Type</label>
                <select
                  value={editArticleType}
                  onChange={(e) => setEditArticleType(Number(e.target.value))}
                  className="w-full rounded-full border border-white/15 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                >
                  {ARTICLE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} className="bg-[#111821] text-slate-100">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200">Body</label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="min-h-[200px] w-full rounded-3xl border border-white/15 bg-black/20 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
                  placeholder="Write article content..."
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200">
                  Tags <span className="text-slate-400">(max 5)</span>
                </label>

                <div className="mb-0.5 flex flex-wrap gap-2">
                  {editTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-2 rounded-sm border border-cyan-300/0 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-400"
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
                      setEditTagInput(normalizeTagName(e.target.value));
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

              {editTagError ? (
                <p className="rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
                  {editTagError}
                </p>
              ) : null}

              {editError ? (
                <p className="rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
                  {editError}
                </p>
              ) : null}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveArticleEdit}
                  disabled={savingEdit}
                  className="rounded-full bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingEdit ? 'Saving...' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelArticleEdit}
                  className="rounded-full border border-white/0 bg-white/10 px-4 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/20"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (

            /* Article voting component */ 
            <div className="flex items-start gap-2">
              <VotePanel
                score={selectedArticle.vote_count}
                currentVote={selectedArticle.current_user_vote}
                onUpvote={handleArticleUpvote}
                upvoteAriaLabel="Upvote article"
                showBookmark
                isBookmarked={Boolean(selectedArticle.is_bookmarked)}
                onToggleBookmark={() => handleToggleArticleBookmark(selectedArticle.id)}
                bookmarkAriaLabel="Bookmark article"
                showBookmarkCount
                bookmarkCount={selectedArticle.bookmarks_count}
              />

              {/* Article body, tags, username */ }
              <div className="min-w-0 flex-1">
                <div className="rounded-2xl border border-white/0 bg-white/5 px-3 py-2 text-sm text-slate-200 whitespace-pre-wrap">
                  {selectedArticle.body}
                  {selectedArticle.tags && selectedArticle.tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedArticle.tags.map((tag) => (
                        <button
                          type="button"
                          key={tag.id || tag.name}
                          onClick={() => handleApplyArticleTagFilter(tag.name || '')}
                          className="rounded-sm border border-cyan-300/0 bg-cyan-500/10 px-3 py-0.5 text-xs font-medium text-cyan-400"
                        >
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 flex items-start gap-3">
                    {!isEditingArticle ? (
                        <button
                        type="button"
                        onClick={handleStartArticleEdit}
                        className="text-xs font-medium text-white/50 transition hover:text-cyan-200"
                        >
                        Edit
                        </button>
                    ) : null}
                  <div className="ml-auto shrink-0 text-right text-xs text-slate-400">
                    <div className="rounded-xl bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200">
                      <span className="block font-medium">published {formatArticleListTime(selectedArticle.created_at)}</span>
                      <button
                        type="button"
                        onClick={() => onOpenUserProfile?.(selectedArticle.user)}
                        className="block text-cyan-100 transition hover:text-white hover:underline"
                      >
                        {selectedArticle.user_name}
                      </button>
                    </div>
                  </div>
                </div>

                <CommentSection
                  targetType="article"
                  targetId={selectedArticle.id}
                  commentsCount={(selectedArticle.comments || []).length}
                  commentData={articleCommentData}
                  collapsed={Boolean(collapsedCommentSections[buildCommentKey('article', selectedArticle.id)])}
                  onToggleCollapsed={() => toggleCommentSection('article', selectedArticle.id)}
                  draftValue={commentDrafts[buildCommentKey('article', selectedArticle.id)] || ''}
                  onDraftChange={(value) => handleCommentDraftChange('article', selectedArticle.id, value)}
                  onAddComment={() => handleAddComment('article', selectedArticle.id, selectedArticle.id)}
                  errorMessage={commentErrors[buildCommentKey('article', selectedArticle.id)]}
                  showDeletedTree={Boolean(showDeletedTrees[buildCommentKey('article', selectedArticle.id)])}
                  onShowDeletedTree={() =>
                    setShowDeletedTrees((prev) => ({
                      ...prev,
                      [buildCommentKey('article', selectedArticle.id)]: true,
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
                  formatTime={formatArticleTime}
                  getCommentKey={buildCommentKey}
                  getCommentItemKey={buildCommentItemKey}
                />
              </div>
            </div>
          )}

          {articleVoteError ? (
            <p className="mt-3 rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
              {articleVoteError}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Article list view */ }
      {!embeddedMode && !loading && !selectedArticle && articles.length > 0 ? (
        <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <ul className="space-y-3">
              {visibleArticles.map((article) => {
                const articleTags = article.tags || [];
                const hasWatchedTag = articleTags.some((tag) => {
                  const tagId = Number(tag.id);
                  const tagName = String(tag.name || '').toLowerCase();
                  return watchedTagIdSet.has(tagId) || watchedTagNameSet.has(tagName);
                });
                const hasIgnoredTag = articleTags.some((tag) => {
                  const tagId = Number(tag.id);
                  const tagName = String(tag.name || '').toLowerCase();
                  return ignoredTagIdSet.has(tagId) || ignoredTagNameSet.has(tagName);
                });

                return (
                  <li key={article.id}>
                    <div className={`flex items-start gap-2 rounded-2xl border px-3 py-3 text-slate-100 ${
                      hasWatchedTag
                        ? 'border-slate-300/25 bg-slate-500/5'
                        : 'border-white/10 bg-black/20'
                    }`}>
                      <VotePanel
                        score={article.vote_count}
                        currentVote={article.current_user_vote}
                        onUpvote={() => handleListArticleUpvote(article.id)}
                        upvoteAriaLabel="Upvote article"
                        showBookmark
                        isBookmarked={Boolean(article.is_bookmarked)}
                        onToggleBookmark={() => handleToggleArticleBookmark(article.id)}
                        bookmarkAriaLabel="Bookmark article"
                      />

                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                            {article.type_label || typeLabelByCode[article.type] || 'Article'}
                          </span>
                          <span className="rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">{article.views_count || 0} views</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => openArticle(article.id, true)}
                          className={`mt-2 text-left text-base font-semibold transition hover:underline ${
                            hasIgnoredTag
                              ? 'text-slate-400 hover:text-slate-300'
                              : 'text-slate-100 hover:text-cyan-200'
                          }`}
                        >
                          {article.title}
                        </button>
                        <p
                          className={`mt-1 text-sm ${hasIgnoredTag ? 'text-slate-500' : 'text-slate-300'}`}
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {article.body}
                        </p>

                        <div className="mt-2 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex flex-wrap gap-2">
                            {(article.tags || []).map((tag) => (
                              <button
                                type="button"
                                key={tag.id || tag.name}
                                onClick={() => handleApplyArticleTagFilter(tag.name || '')}
                                className={`rounded-sm border px-2.5 py-0.5 text-[11px] font-medium ${
                                  hasIgnoredTag
                                    ? 'border-white/10 bg-white/10 text-slate-400'
                                    : 'border-cyan-300/0 bg-cyan-300/10 text-cyan-400'
                                }`}
                              >
                                {tag.name}
                              </button>
                            ))}
                          </div>
                          <span className="shrink-0 text-xs text-slate-400">
                            <button
                              type="button"
                              onClick={() => onOpenUserProfile?.(article.user_id || article.user)}
                              className="font-medium text-slate-300 transition hover:text-cyan-200 hover:underline"
                            >
                              {article.user_name}
                            </button>{' '}
                            created {formatArticleListTime(article.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

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
              onTagSelect={handleApplyArticleTagFilter}
              onSetTagPreference={handleSetTagPreference}
              updatingTagPreferenceKey={updatingTagPreferenceKey}
              loading={loadingTagPreferences}
              error={tagPreferenceError}
            />

            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <h3 className="text-xs font-semibold tracking-[0.12em] text-slate-300 uppercase">Related Tags</h3>

              <div className="mt-2 flex flex-wrap gap-2">
                {articleTagCounts.length === 0 ? (
                  <p className="text-xs text-slate-400">No tags found in articles.</p>
                ) : (
                  articleTagCounts.map((tag) => (
                    <button
                      key={`article-tag-count-${tag.name}`}
                      type="button"
                      onClick={() => handleApplyArticleTagFilter(tag.name)}
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
      ) : null}

      {/* Article creation modal */ }
      <PostComposerModal
        open={!embeddedMode && showCreateModal}
        modalTitle="Create a new article"
        modalSubtitle="Publish official long-form content for your team."
        onSubmit={handleCreateArticle}
        titleValue={title}
        onTitleChange={setTitle}
        titlePlaceholder="Article title"
        bodyValue={body}
        onBodyChange={setBody}
        bodyPlaceholder="Write article content..."
        bodyMinHeightClassName="min-h-[200px]"
        extraFields={(
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-200">Type</label>
            <select
              value={articleType}
              onChange={(e) => setArticleType(Number(e.target.value))}
              className="w-full rounded-full border border-white/15 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
            >
              {ARTICLE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#111821] text-slate-100">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
        tags={articleTags}
        onRemoveTag={removeTag}
        tagInput={tagInput}
        onTagInputChange={(value) => {
          setTagError('');
          setTagInput(normalizeTagName(value));
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
        formError={formError}
        isSubmitting={submitting}
        submitLabel="Create Article"
        submittingLabel="Publishing..."
        cancelLabel="Close"
        onClose={() => {
          setShowCreateModal(false);
          resetCreateForm();
        }}
        submitButtonClassName="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        closeButtonClassName="rounded-full border border-white/0 bg-white/10 px-5 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/20"
      />
    </div>
  );
}

export default ArticlesTab;
