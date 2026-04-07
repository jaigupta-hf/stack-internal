import useCollectionsTabController from '../../hooks/useCollectionsTabController';
import CollectionsTabView from '../../components/CollectionsTabView';

function CollectionsTab({ team, isTeamAdmin, onOpenUserProfile }) {
  const controller = useCollectionsTabController({ team });

  return (
    <CollectionsTabView
      team={team}
      isTeamAdmin={isTeamAdmin}
      onOpenUserProfile={onOpenUserProfile}
      controller={controller}
    />
  );
}

export default CollectionsTab;
