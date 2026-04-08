import useCollectionsTabController from '../../hooks/useCollectionsTabController';
import CollectionsTabView from '../../components/CollectionsTabView';
import { useTeam } from '../../context/TeamContext';

function CollectionsTab({ onOpenUserProfile }) {
  const { activeTeam, isTeamAdmin } = useTeam();
  const controller = useCollectionsTabController({ team: activeTeam });

  return (
    <CollectionsTabView
      team={activeTeam}
      isTeamAdmin={isTeamAdmin}
      onOpenUserProfile={onOpenUserProfile}
      controller={controller}
    />
  );
}

export default CollectionsTab;
