import QuestionListPanel from './QuestionListPanel';
import QuestionDetailPanel from './QuestionDetailPanel';
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

      <QuestionDetailPanel controller={controller} onOpenUserProfile={onOpenUserProfile} />
    </>
  );
}

export default QuestionTabView;
