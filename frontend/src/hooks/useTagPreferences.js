import { useCallback, useEffect, useMemo, useState } from 'react';
import { tagService } from '../services/api';

function useTagPreferences({ teamId, clearPreferencesOnLoadError = false }) {
  const [tagPreferences, setTagPreferences] = useState([]);
  const [loadingTagPreferences, setLoadingTagPreferences] = useState(false);
  const [tagPreferenceError, setTagPreferenceError] = useState('');
  const [updatingTagPreferenceKey, setUpdatingTagPreferenceKey] = useState('');
  const [allTeamTags, setAllTeamTags] = useState([]);
  const [watchTagInput, setWatchTagInput] = useState('');
  const [ignoreTagInput, setIgnoreTagInput] = useState('');

  const loadTagPreferences = useCallback(async () => {
    if (!teamId) {
      setTagPreferences([]);
      return;
    }

    setLoadingTagPreferences(true);
    setTagPreferenceError('');

    try {
      const data = await tagService.listPreferences(teamId);
      setTagPreferences(data || []);
    } catch (err) {
      if (clearPreferencesOnLoadError) {
        setTagPreferences([]);
      }
      setTagPreferenceError(err.response?.data?.error || 'Failed to load tag preferences.');
    } finally {
      setLoadingTagPreferences(false);
    }
  }, [teamId, clearPreferencesOnLoadError]);

  useEffect(() => {
    loadTagPreferences();
  }, [loadTagPreferences]);

  useEffect(() => {
    const loadAllTags = async () => {
      if (!teamId) {
        setAllTeamTags([]);
        return;
      }

      try {
        const data = await tagService.listTags(teamId);
        setAllTeamTags(data || []);
      } catch {
        setAllTeamTags([]);
      }
    };

    loadAllTags();
  }, [teamId]);

  const watchingTags = useMemo(
    () => (tagPreferences || []).filter((tag) => tag.is_watching),
    [tagPreferences],
  );

  const ignoredTags = useMemo(
    () => (tagPreferences || []).filter((tag) => tag.is_ignored),
    [tagPreferences],
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
    [watchingTags],
  );

  const watchedTagNameSet = useMemo(
    () => new Set(watchingTags.map((tag) => String(tag.tag_name || '').toLowerCase())),
    [watchingTags],
  );

  const ignoredTagIdSet = useMemo(
    () => new Set(ignoredTags.map((tag) => Number(tag.tag_id))),
    [ignoredTags],
  );

  const ignoredTagNameSet = useMemo(
    () => new Set(ignoredTags.map((tag) => String(tag.tag_name || '').toLowerCase())),
    [ignoredTags],
  );

  const upsertTagPreference = useCallback((updated) => {
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
            : item,
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
  }, []);

  const handleSetTagPreference = useCallback(async ({ tagId, field, value }) => {
    if (!teamId) {
      return;
    }

    const requestKey = `${field}:${tagId}`;
    setUpdatingTagPreferenceKey(requestKey);
    setTagPreferenceError('');

    try {
      const updated = await tagService.updatePreference({
        teamId,
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
  }, [teamId, upsertTagPreference]);

  return {
    tagPreferences,
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
  };
}

export default useTagPreferences;
