import { useCallback, useEffect, useMemo, useState } from 'react';
import { postService, voteService } from '../../services/api';

function useArticlesListDomain({
  teamId,
  selectedArticle,
  setSelectedArticle,
  resetCommentSectionState,
  setCommentErrors,
  setArticleVoteError,
  getArticleIdFromUrl,
  setArticleIdInUrl,
}) {
  const [openingArticle, setOpeningArticle] = useState(false);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedArticleTagFilter, setSelectedArticleTagFilter] = useState('');

  useEffect(() => {
    const loadArticles = async () => {
      if (!teamId) {
        setArticles([]);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const data = await postService.listArticles(teamId);
        setArticles(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load articles.');
      } finally {
        setLoading(false);
      }
    };

    loadArticles();
  }, [teamId]);

  useEffect(() => {
    setSelectedArticle(null);
    resetCommentSectionState();
    setArticleVoteError('');
  }, [teamId, resetCommentSectionState, setArticleVoteError, setSelectedArticle]);

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

  const handleApplyArticleTagFilter = useCallback((tagName) => {
    if (!tagName) {
      return;
    }

    setSelectedArticleTagFilter(tagName);
  }, []);

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
      if (updateUrl) {
        setArticleIdInUrl(articleId);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to open article.');
    } finally {
      setOpeningArticle(false);
    }
  }, [setArticleIdInUrl, setArticleVoteError, setCommentErrors, setSelectedArticle]);

  const handleBackToArticleList = useCallback(() => {
    if (getArticleIdFromUrl()) {
      setArticleIdInUrl(null, true);
    }

    setSelectedArticle(null);
    resetCommentSectionState();
    setArticleVoteError('');
  }, [
    getArticleIdFromUrl,
    resetCommentSectionState,
    setArticleIdInUrl,
    setArticleVoteError,
    setSelectedArticle,
  ]);

  useEffect(() => {
    const syncFromUrl = async () => {
      const urlArticleId = getArticleIdFromUrl();

      if (!urlArticleId) {
        if (selectedArticle) {
          setSelectedArticle(null);
          resetCommentSectionState();
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
  }, [
    getArticleIdFromUrl,
    openArticle,
    resetCommentSectionState,
    selectedArticle,
    setArticleVoteError,
    setSelectedArticle,
    teamId,
  ]);

  const handleArticleUpvote = useCallback(async () => {
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
  }, [selectedArticle, setArticleVoteError, setSelectedArticle]);

  const handleListArticleUpvote = useCallback(async (articleId) => {
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
  }, [articles, setSelectedArticle]);

  const handleToggleArticleBookmark = useCallback(async (articleId) => {
    const article = articles.find((item) => item.id === articleId);
    const isBookmarked =
      article?.is_bookmarked ||
      (selectedArticle?.id === articleId && selectedArticle.is_bookmarked);

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
  }, [articles, selectedArticle, setSelectedArticle]);

  return {
    openingArticle,
    setOpeningArticle,
    articles,
    setArticles,
    loading,
    setLoading,
    error,
    setError,
    selectedArticleTagFilter,
    setSelectedArticleTagFilter,
    visibleArticles,
    articleTagCounts,
    handleApplyArticleTagFilter,
    openArticle,
    handleBackToArticleList,
    handleArticleUpvote,
    handleListArticleUpvote,
    handleToggleArticleBookmark,
  };
}

export default useArticlesListDomain;
