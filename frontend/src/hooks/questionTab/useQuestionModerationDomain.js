import { useCallback, useEffect, useState } from 'react';
import { postService } from '../../services/api';

function useQuestionModerationDomain({
  teamId,
  selectedQuestion,
  setSelectedQuestion,
  setQuestions,
  setShowAnswerSection,
  loadQuestions,
  setListError,
}) {
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReason, setCloseReason] = useState('off-topic');
  const [closeError, setCloseError] = useState('');
  const [closingQuestion, setClosingQuestion] = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState(false);
  const [duplicateQuery, setDuplicateQuery] = useState('');
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [searchingDuplicate, setSearchingDuplicate] = useState(false);
  const [selectedDuplicate, setSelectedDuplicate] = useState(null);

  useEffect(() => {
    if (!showCloseModal || closeReason !== 'duplicate' || !teamId) {
      return;
    }

    const query = duplicateQuery.trim();
    if (!query) {
      setDuplicateMatches([]);
      setSearchingDuplicate(false);
      return;
    }

    const debounce = setTimeout(async () => {
      try {
        setSearchingDuplicate(true);
        const result = await postService.searchQuestions(teamId, query);
        const selectedQuestionId = selectedQuestion?.id;
        const filtered = (result || []).filter((item) => item.id !== selectedQuestionId);
        setDuplicateMatches(filtered);
      } catch {
        setDuplicateMatches([]);
      } finally {
        setSearchingDuplicate(false);
      }
    }, 250);

    return () => clearTimeout(debounce);
  }, [showCloseModal, closeReason, duplicateQuery, teamId, selectedQuestion]);

  const handleOpenCloseModal = useCallback(() => {
    setCloseReason('off-topic');
    setCloseError('');
    setDuplicateQuery('');
    setDuplicateMatches([]);
    setSelectedDuplicate(null);
    setShowCloseModal(true);
  }, []);

  const handleCloseQuestion = useCallback(async () => {
    if (!selectedQuestion) {
      return;
    }

    if (selectedQuestion.closed_reason) {
      setCloseError('Question is already closed.');
      return;
    }

    if (closeReason === 'duplicate' && !selectedDuplicate) {
      setCloseError('Select a duplicate question first.');
      return;
    }

    try {
      setClosingQuestion(true);
      setCloseError('');

      const payload = {
        reason: closeReason,
      };
      if (closeReason === 'duplicate' && selectedDuplicate) {
        payload.duplicate_post_id = selectedDuplicate.id;
      }

      const result = await postService.closeQuestion(selectedQuestion.id, payload);

      setSelectedQuestion((prev) =>
        prev
          ? {
              ...prev,
              is_closed: true,
              closed_reason: result.closed_reason,
              closed_at: result.closed_at,
              closed_by: result.closed_by,
              closed_by_username: result.closed_by_username,
              duplicate_post_id: result.duplicate_post_id,
              duplicate_post_title: result.duplicate_post_title,
              parent: result.duplicate_post_id || null,
            }
          : prev
      );

      setQuestions((prev) =>
        prev.map((item) =>
          item.id === selectedQuestion.id
            ? {
                ...item,
                is_closed: true,
                closed_reason: result.closed_reason,
                closed_at: result.closed_at,
                closed_by: result.closed_by,
                closed_by_username: result.closed_by_username,
                duplicate_post_id: result.duplicate_post_id,
                duplicate_post_title: result.duplicate_post_title,
                parent: result.duplicate_post_id || null,
              }
            : item
        )
      );

      setShowAnswerSection(false);
      setShowCloseModal(false);
    } catch (err) {
      setCloseError(err.response?.data?.error || 'Failed to close question.');
    } finally {
      setClosingQuestion(false);
    }
  }, [
    closeReason,
    selectedDuplicate,
    selectedQuestion,
    setQuestions,
    setSelectedQuestion,
    setShowAnswerSection,
  ]);

  const handleReopenQuestion = useCallback(async () => {
    if (!selectedQuestion) {
      return;
    }

    try {
      setListError('');
      const result = await postService.reopenQuestion(selectedQuestion.id);

      setSelectedQuestion((prev) =>
        prev
          ? {
              ...prev,
              is_closed: false,
              closed_reason: result.closed_reason,
              closed_at: result.closed_at,
              closed_by: result.closed_by,
              closed_by_username: result.closed_by_username,
              duplicate_post_id: result.duplicate_post_id,
              duplicate_post_title: result.duplicate_post_title,
              parent: null,
            }
          : prev
      );

      setQuestions((prev) =>
        prev.map((item) =>
          item.id === selectedQuestion.id
            ? {
                ...item,
                is_closed: false,
                closed_reason: result.closed_reason,
                closed_at: result.closed_at,
                closed_by: result.closed_by,
                closed_by_username: result.closed_by_username,
                duplicate_post_id: result.duplicate_post_id,
                duplicate_post_title: result.duplicate_post_title,
                parent: null,
              }
            : item
        )
      );
    } catch (err) {
      setListError(err.response?.data?.error || 'Failed to reopen question.');
    }
  }, [selectedQuestion, setListError, setQuestions, setSelectedQuestion]);

  const handleDeleteQuestion = useCallback(async () => {
    if (!selectedQuestion || selectedQuestion.delete_flag) {
      return;
    }

    try {
      setDeletingQuestion(true);
      setListError('');
      await postService.deleteQuestion(selectedQuestion.id);

      setSelectedQuestion((prev) => (prev ? { ...prev, delete_flag: true } : prev));
      setQuestions((prev) => prev.filter((item) => item.id !== selectedQuestion.id));
      setShowAnswerSection(false);
    } catch (err) {
      setListError(err.response?.data?.error || 'Failed to delete question.');
    } finally {
      setDeletingQuestion(false);
    }
  }, [selectedQuestion, setListError, setQuestions, setSelectedQuestion, setShowAnswerSection]);

  const handleUndeleteQuestion = useCallback(async () => {
    if (!selectedQuestion || !selectedQuestion.delete_flag) {
      return;
    }

    try {
      setDeletingQuestion(true);
      setListError('');
      await postService.undeleteQuestion(selectedQuestion.id);

      setSelectedQuestion((prev) => (prev ? { ...prev, delete_flag: false } : prev));
      await loadQuestions();
    } catch (err) {
      setListError(err.response?.data?.error || 'Failed to undelete question.');
    } finally {
      setDeletingQuestion(false);
    }
  }, [loadQuestions, selectedQuestion, setListError, setSelectedQuestion]);

  return {
    showCloseModal,
    setShowCloseModal,
    closeReason,
    setCloseReason,
    closeError,
    setCloseError,
    closingQuestion,
    setClosingQuestion,
    deletingQuestion,
    setDeletingQuestion,
    duplicateQuery,
    setDuplicateQuery,
    duplicateMatches,
    setDuplicateMatches,
    searchingDuplicate,
    setSearchingDuplicate,
    selectedDuplicate,
    setSelectedDuplicate,
    handleOpenCloseModal,
    handleCloseQuestion,
    handleReopenQuestion,
    handleDeleteQuestion,
    handleUndeleteQuestion,
  };
}

export default useQuestionModerationDomain;
