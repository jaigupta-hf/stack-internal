import useQuestionTabController from '../../hooks/questionTab/useQuestionTabController';
import QuestionTabView from '../../components/questionTab/QuestionTabView';
import { useTeam } from '../../context/TeamContext';

function QuestionTab({ embeddedMode = false, onOpenUserProfile }) {
  const { activeTeam } = useTeam();
  const controller = useQuestionTabController({ team: activeTeam });

  return (
    <QuestionTabView
      embeddedMode={embeddedMode}
      onOpenUserProfile={onOpenUserProfile}
      controller={controller}
    />
  );
}

export default QuestionTab;
