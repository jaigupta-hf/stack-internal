import { useMemo, useState } from 'react';
import { postService, voteService } from '../../services/api';

function useQuestionAnswersDomain({
  currentUserId,
  selectedQuestion,
  setSelectedQuestion,
  setQuestions,
}) {
  const [showAnswerSection, setShowAnswerSection] = useState(false);
  const [answerBody, setAnswerBody] = useState('');
  const [answerError, setAnswerError] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [deletingAnswerId, setDeletingAnswerId] = useState(null);
  const [editingAnswerId, setEditingAnswerId] = useState(null);
  const [editAnswerBody, setEditAnswerBody] = useState('');
  const [editAnswerError, setEditAnswerError] = useState('');
  const [savingAnswerEdit, setSavingAnswerEdit] = useState(false);
  const [voteError, setVoteError] = useState('');
  const [approvalError, setApprovalError] = useState('');

  const handleAnswerSubmit = async (e) => {
    e.preventDefault();
    if (!selectedQuestion) {
      return;
    }

    if (selectedQuestion.delete_flag) {
      setAnswerError('This question is deleted and not accepting new answers.');
      setShowAnswerSection(false);
      return;
    }

    if (selectedQuestion.closed_reason) {
      setAnswerError('This question is closed and not accepting new answers.');
      setShowAnswerSection(false);
      return;
    }

    setAnswerError('');
    setSubmittingAnswer(true);

    try {
      const created = await postService.createAnswer(selectedQuestion.id, { body: answerBody });
      setSelectedQuestion((prev) => {
        if (!prev) {
          return prev;
        }

        const existingAnswers = prev.answers || [];
        return {
          ...prev,
          answers: [...existingAnswers, created],
        };
      });
      setAnswerBody('');
      setShowAnswerSection(false);
    } catch (err) {
      setAnswerError(err.response?.data?.error || 'Failed to post answer. Please try again.');
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handleStartAnswerEdit = (answer) => {
    if (Number(answer?.user || 0) !== Number(currentUserId || 0)) {
      return;
    }

    setEditingAnswerId(answer.id);
    setEditAnswerBody(answer.body || '');
    setEditAnswerError('');
  };

  const handleSaveAnswerEdit = async () => {
    if (!editingAnswerId) {
      return;
    }

    const targetAnswer = (selectedQuestion?.answers || []).find((item) => item.id === editingAnswerId);
    if (!targetAnswer || Number(targetAnswer.user || 0) !== Number(currentUserId || 0)) {
      setEditAnswerError('Only the answer author can edit this answer.');
      return;
    }

    setEditAnswerError('');
    setSavingAnswerEdit(true);

    try {
      const updated = await postService.updateAnswer(editingAnswerId, {
        body: editAnswerBody,
      });

      setSelectedQuestion((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          answers: (prev.answers || []).map((answer) =>
            answer.id === updated.id ? { ...answer, ...updated } : answer
          ),
        };
      });
      setEditingAnswerId(null);
      setEditAnswerBody('');
    } catch (err) {
      setEditAnswerError(err.response?.data?.error || 'Failed to update answer.');
    } finally {
      setSavingAnswerEdit(false);
    }
  };

  const handleQuestionVote = async (voteValue) => {
    if (!selectedQuestion) {
      return;
    }

    const currentVote = Number(selectedQuestion.current_user_vote || 0);

    try {
      setVoteError('');
      const result =
        currentVote === voteValue
          ? await voteService.removeVote({ postId: selectedQuestion.id })
          : await voteService.submitVote({ postId: selectedQuestion.id, vote: voteValue });

      setSelectedQuestion((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          vote_count: result.vote_count,
          current_user_vote: result.vote,
        };
      });

      setQuestions((prev) =>
        prev.map((question) =>
          question.id === selectedQuestion.id
            ? {
                ...question,
                vote_count: result.vote_count,
                current_user_vote: result.vote,
              }
            : question
        )
      );
    } catch (err) {
      setVoteError(err.response?.data?.error || 'Failed to vote on question.');
    }
  };

  const handleDeleteAnswer = async (answerId) => {
    if (!selectedQuestion) {
      return;
    }

    const targetAnswer = (selectedQuestion.answers || []).find((item) => item.id === answerId);
    if (!targetAnswer || Number(targetAnswer.user || 0) !== Number(currentUserId || 0)) {
      setVoteError('Only the answer author can delete this answer.');
      return;
    }

    try {
      setDeletingAnswerId(answerId);
      setVoteError('');
      await postService.deleteAnswer(answerId);

      setSelectedQuestion((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          approved_answer: prev.approved_answer === answerId ? null : prev.approved_answer,
          answers: (prev.answers || []).map((item) =>
            item.id === answerId
              ? {
                  ...item,
                  delete_flag: true,
                }
              : item
          ),
        };
      });
    } catch (err) {
      setVoteError(err.response?.data?.error || 'Failed to delete answer.');
    } finally {
      setDeletingAnswerId(null);
    }
  };

  const handleUndeleteAnswer = async (answerId) => {
    if (!selectedQuestion) {
      return;
    }

    const targetAnswer = (selectedQuestion.answers || []).find((item) => item.id === answerId);
    if (!targetAnswer || Number(targetAnswer.user || 0) !== Number(currentUserId || 0)) {
      setVoteError('Only the answer author can undelete this answer.');
      return;
    }

    try {
      setDeletingAnswerId(answerId);
      setVoteError('');
      await postService.undeleteAnswer(answerId);

      setSelectedQuestion((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          answers: (prev.answers || []).map((item) =>
            item.id === answerId
              ? {
                  ...item,
                  delete_flag: false,
                }
              : item
          ),
        };
      });
    } catch (err) {
      setVoteError(err.response?.data?.error || 'Failed to undelete answer.');
    } finally {
      setDeletingAnswerId(null);
    }
  };

  const handleAnswerVote = async (answerId, voteValue) => {
    if (selectedQuestion?.delete_flag) {
      setVoteError('Cannot vote on answers for a deleted question.');
      return;
    }

    const answer = (selectedQuestion?.answers || []).find((item) => item.id === answerId);
    if (!answer) {
      return;
    }

    if (answer.delete_flag) {
      setVoteError('Cannot vote on a deleted answer.');
      return;
    }

    const currentVote = Number(answer.current_user_vote || 0);

    try {
      setVoteError('');
      const result =
        currentVote === voteValue
          ? await voteService.removeVote({ postId: answerId })
          : await voteService.submitVote({ postId: answerId, vote: voteValue });

      setSelectedQuestion((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          answers: (prev.answers || []).map((item) =>
            item.id === answerId
              ? {
                  ...item,
                  vote_count: result.vote_count,
                  current_user_vote: result.vote,
                }
              : item
          ),
        };
      });
    } catch (err) {
      setVoteError(err.response?.data?.error || 'Failed to vote on answer.');
    }
  };

  const handleApproveAnswer = async (answerId) => {
    if (!selectedQuestion || !selectedQuestion.can_approve_answers) {
      return;
    }

    if (selectedQuestion.delete_flag) {
      setApprovalError('Cannot approve answers for a deleted question.');
      return;
    }

    const targetAnswer = (selectedQuestion.answers || []).find((item) => item.id === answerId);
    if (!targetAnswer || targetAnswer.delete_flag) {
      setApprovalError('Cannot approve a deleted answer.');
      return;
    }

    try {
      setApprovalError('');
      const nextApprovedAnswerId = selectedQuestion.approved_answer === answerId ? null : answerId;
      const result = await postService.approveAnswer(selectedQuestion.id, nextApprovedAnswerId);
      setSelectedQuestion((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          approved_answer: result.approved_answer,
        };
      });
      setQuestions((prev) =>
        prev.map((question) =>
          question.id === selectedQuestion.id
            ? { ...question, approved_answer: result.approved_answer }
            : question
        )
      );
    } catch (err) {
      setApprovalError(err.response?.data?.error || 'Failed to approve answer.');
    }
  };

  const sortedAnswers = useMemo(() => {
    if (!selectedQuestion?.answers) {
      return [];
    }

    const approvedAnswerId = selectedQuestion.approved_answer;
    if (!approvedAnswerId) {
      return selectedQuestion.answers;
    }

    const approved = selectedQuestion.answers.find((answer) => answer.id === approvedAnswerId);
    if (!approved) {
      return selectedQuestion.answers;
    }

    const remaining = selectedQuestion.answers.filter((answer) => answer.id !== approvedAnswerId);
    return [approved, ...remaining];
  }, [selectedQuestion]);

  return {
    showAnswerSection,
    setShowAnswerSection,
    answerBody,
    setAnswerBody,
    answerError,
    setAnswerError,
    submittingAnswer,
    setSubmittingAnswer,
    deletingAnswerId,
    setDeletingAnswerId,
    editingAnswerId,
    setEditingAnswerId,
    editAnswerBody,
    setEditAnswerBody,
    editAnswerError,
    setEditAnswerError,
    savingAnswerEdit,
    setSavingAnswerEdit,
    voteError,
    setVoteError,
    approvalError,
    setApprovalError,
    handleAnswerSubmit,
    handleStartAnswerEdit,
    handleSaveAnswerEdit,
    handleQuestionVote,
    handleDeleteAnswer,
    handleUndeleteAnswer,
    handleAnswerVote,
    handleApproveAnswer,
    sortedAnswers,
  };
}

export default useQuestionAnswersDomain;
