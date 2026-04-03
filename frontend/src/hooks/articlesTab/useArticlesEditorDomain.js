import { useCallback, useEffect, useMemo, useState } from 'react';
import { postService, tagService } from '../../services/api';
import { ARTICLE_TYPE_OPTIONS } from './articleTabConstants';

function useArticlesEditorDomain({
  teamId,
  selectedArticle,
  setSelectedArticle,
  setArticles,
}) {
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
        team_id: teamId,
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

  const resetEditState = useCallback(() => {
    setIsEditingArticle(false);
    setEditError('');
    setEditTagError('');
    setEditTagInput('');
    setEditTagSuggestions([]);
  }, []);

  return {
    showCreateModal,
    setShowCreateModal,
    title,
    setTitle,
    articleType,
    setArticleType,
    body,
    setBody,
    tagInput,
    setTagInput,
    articleTags,
    setArticleTags,
    tagSuggestions,
    setTagSuggestions,
    searchingTags,
    setSearchingTags,
    submitting,
    setSubmitting,
    formError,
    setFormError,
    tagError,
    setTagError,
    isEditingArticle,
    setIsEditingArticle,
    editTitle,
    setEditTitle,
    editArticleType,
    setEditArticleType,
    editBody,
    setEditBody,
    editTagInput,
    setEditTagInput,
    editTags,
    setEditTags,
    editTagSuggestions,
    setEditTagSuggestions,
    searchingEditTags,
    setSearchingEditTags,
    editError,
    setEditError,
    editTagError,
    setEditTagError,
    savingEdit,
    setSavingEdit,
    normalizeTagName,
    isNumericOnlyTag,
    addTag,
    removeTag,
    addEditTag,
    removeEditTag,
    resetCreateForm,
    handleCreateArticle,
    typeLabelByCode,
    handleStartArticleEdit,
    handleCancelArticleEdit,
    handleSaveArticleEdit,
    resetEditState,
    ARTICLE_TYPE_OPTIONS,
  };
}

export default useArticlesEditorDomain;
