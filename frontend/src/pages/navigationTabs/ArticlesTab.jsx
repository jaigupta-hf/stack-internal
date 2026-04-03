import useArticlesTabController from '../../hooks/articlesTab/useArticlesTabController';
import ArticlesTabView from '../../components/articlesTab/ArticlesTabView';

function ArticlesTab({ team, embeddedMode = false, onOpenUserProfile }) {
  const controller = useArticlesTabController({ team });

  return (
    <ArticlesTabView
      embeddedMode={embeddedMode}
      onOpenUserProfile={onOpenUserProfile}
      controller={controller}
    />
  );
}

export default ArticlesTab;
