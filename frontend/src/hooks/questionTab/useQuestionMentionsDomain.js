import { useCallback, useMemo, useState } from 'react';
import { postService, teamService } from '../../services/api';

function useQuestionMentionsDomain({
  teamId,
  selectedQuestion,
  setSelectedQuestion,
  setListError,
}) {
  const [teamMembers, setTeamMembers] = useState([]);
  const [mentionSearchOpen, setMentionSearchOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionError, setMentionError] = useState('');
  const [mentioningUserId, setMentioningUserId] = useState(null);
  const [removingMentionUserId, setRemovingMentionUserId] = useState(null);
  const [followingQuestion, setFollowingQuestion] = useState(false);

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
    if (!teamId) {
      return;
    }

    if (!force && teamMembers.length > 0) {
      return;
    }

    try {
      setMentionLoading(true);
      setMentionError('');
      const data = await teamService.listTeamUsers(teamId);
      setTeamMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      setMentionError(err.response?.data?.error || 'Failed to load team users.');
    } finally {
      setMentionLoading(false);
    }
  }, [teamId, teamMembers.length]);

  const handleToggleMentionSearch = useCallback(async () => {
    const nextOpen = !mentionSearchOpen;
    setMentionSearchOpen(nextOpen);
    setMentionError('');

    if (nextOpen) {
      await loadTeamMembers(true);
    }
  }, [loadTeamMembers, mentionSearchOpen]);

  const handleMentionUser = useCallback(async (targetUserId) => {
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
  }, [selectedQuestion, setSelectedQuestion]);

  const handleRemoveMentionUser = useCallback(async (targetUserId) => {
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
  }, [selectedQuestion, setSelectedQuestion]);

  const handleToggleFollowQuestion = useCallback(async () => {
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
  }, [selectedQuestion, setListError, setSelectedQuestion]);

  return {
    teamMembers,
    setTeamMembers,
    mentionSearchOpen,
    setMentionSearchOpen,
    mentionQuery,
    setMentionQuery,
    mentionLoading,
    setMentionLoading,
    mentionError,
    setMentionError,
    mentioningUserId,
    setMentioningUserId,
    removingMentionUserId,
    setRemovingMentionUserId,
    followingQuestion,
    setFollowingQuestion,
    mentionedUserIdSet,
    mentionCandidates,
    loadTeamMembers,
    handleToggleMentionSearch,
    handleMentionUser,
    handleRemoveMentionUser,
    handleToggleFollowQuestion,
  };
}

export default useQuestionMentionsDomain;
