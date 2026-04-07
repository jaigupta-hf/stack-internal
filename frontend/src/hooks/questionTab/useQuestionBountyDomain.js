import { useState } from 'react';
import { postService } from '../../services/api';
import { BOUNTY_REASONS } from './questionTabConstants';

function useQuestionBountyDomain({
  selectedQuestion,
  setSelectedQuestion,
  setQuestions,
  setApprovalError,
}) {
  const [showBountyModal, setShowBountyModal] = useState(false);
  const [selectedBountyReason, setSelectedBountyReason] = useState(BOUNTY_REASONS[0].title);
  const [offeringBounty, setOfferingBounty] = useState(false);
  const [awardingBountyAnswerId, setAwardingBountyAnswerId] = useState(null);

  const handleOfferBounty = async () => {
    if (!selectedQuestion || !selectedQuestion.can_offer_bounty) {
      return;
    }

    try {
      setOfferingBounty(true);
      setApprovalError('');
      const result = await postService.offerQuestionBounty(selectedQuestion.id, selectedBountyReason);

      setSelectedQuestion((prev) =>
        prev
          ? {
              ...prev,
              bounty_amount: result.bounty_amount || 0,
              bounty: result.bounty || null,
              can_offer_bounty: false,
              can_award_bounty: true,
            }
          : prev
      );
      setQuestions((prev) =>
        prev.map((question) =>
          question.id === selectedQuestion.id
            ? {
                ...question,
                bounty_amount: result.bounty_amount || 0,
              }
            : question
        )
      );
      setShowBountyModal(false);
    } catch (err) {
      setApprovalError(err.response?.data?.error || 'Failed to offer bounty.');
    } finally {
      setOfferingBounty(false);
    }
  };

  const handleAwardBounty = async (answerId) => {
    if (!selectedQuestion || !selectedQuestion.can_award_bounty || (selectedQuestion.bounty_amount || 0) <= 0) {
      return;
    }

    try {
      setAwardingBountyAnswerId(answerId);
      setApprovalError('');
      const result = await postService.awardQuestionBounty(selectedQuestion.id, answerId);

      setSelectedQuestion((prev) => {
        if (!prev) {
          return prev;
        }

        const nextCanOffer = !prev.delete_flag && !prev.closed_reason;
        return {
          ...prev,
          bounty_amount: result.bounty_amount || 0,
          bounty: result.bounty || null,
          can_award_bounty: false,
          can_offer_bounty: nextCanOffer,
        };
      });

      setQuestions((prev) =>
        prev.map((question) =>
          question.id === selectedQuestion.id
            ? {
                ...question,
                bounty_amount: result.bounty_amount || 0,
              }
            : question
        )
      );
    } catch (err) {
      setApprovalError(err.response?.data?.error || 'Failed to award bounty.');
    } finally {
      setAwardingBountyAnswerId(null);
    }
  };

  return {
    showBountyModal,
    setShowBountyModal,
    selectedBountyReason,
    setSelectedBountyReason,
    offeringBounty,
    setOfferingBounty,
    awardingBountyAnswerId,
    setAwardingBountyAnswerId,
    handleOfferBounty,
    handleAwardBounty,
  };
}

export default useQuestionBountyDomain;
