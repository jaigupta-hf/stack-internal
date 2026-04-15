import QuestionListPanel from './QuestionListPanel';
import QuestionDetailPanel from './QuestionDetailPanel';
import QuestionHistoryPage from './QuestionHistoryPage';
import QuestionModals from './QuestionModals';

function QuestionTabView({ embeddedMode = false, onOpenUserProfile, controller }) {
  return (
    <>
      <QuestionListPanel
        controller={controller}
        embeddedMode={embeddedMode}
        onOpenUserProfile={onOpenUserProfile}
      />

      <QuestionModals
        controller={controller}
        embeddedMode={embeddedMode}
        onOpenUserProfile={onOpenUserProfile}
      />

      {controller.showQuestionHistory ? (
        <QuestionHistoryPage controller={controller} />
      ) : (
        <QuestionDetailPanel controller={controller} onOpenUserProfile={onOpenUserProfile} />
      )}
    </>
  );
}

export default QuestionTabView;
