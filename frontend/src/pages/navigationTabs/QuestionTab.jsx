import useQuestionTabController from '../../hooks/questionTab/useQuestionTabController';
import QuestionTabView from '../../components/questionTab/QuestionTabView';

function QuestionTab({ team, embeddedMode = false, onOpenUserProfile }) {
  const controller = useQuestionTabController({ team });

  return (
    <QuestionTabView
      embeddedMode={embeddedMode}
      onOpenUserProfile={onOpenUserProfile}
      controller={controller}
    />
  );
}

export default QuestionTab;
