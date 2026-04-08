import useArticlesTabController from '../../hooks/articlesTab/useArticlesTabController';
import ArticlesTabView from '../../components/articlesTab/ArticlesTabView';
import { useTeam } from '../../context/TeamContext';

function ArticlesTab({ embeddedMode = false, onOpenUserProfile }) {
  const { activeTeam } = useTeam();
  const controller = useArticlesTabController({ team: activeTeam });

  return (
    <ArticlesTabView
      embeddedMode={embeddedMode}
      onOpenUserProfile={onOpenUserProfile}
      controller={controller}
    />
  );
}

export default ArticlesTab;
