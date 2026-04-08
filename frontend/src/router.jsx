import { Navigate, createBrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import {
  ArticlesTabRoute,
  BookmarksTabRoute,
  CollectionsTabRoute,
  ForYouTabRoute,
  HomeTabRoute,
  ProfileRoute,
  QuestionTabRoute,
  TagsTabRoute,
  UsersTabRoute,
} from './routes/teamRouteElements.jsx';
import AppIndexPage from './pages/AppIndexPage.jsx';

function TeamSlugRedirect() {
  return <Navigate to="home" replace />;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppIndexPage />,
  },
  {
    path: '/:teamSlug',
    element: <App />,
    children: [
      {
        index: true,
        element: <TeamSlugRedirect />,
      },
      {
        path: 'home',
        element: <HomeTabRoute />,
        handle: { tab: 'Home' },
      },
      {
        path: 'questions',
        element: <QuestionTabRoute />,
        handle: { tab: 'Questions' },
      },
      {
        path: 'articles',
        element: <ArticlesTabRoute />,
        handle: { tab: 'Articles' },
      },
      {
        path: 'collections',
        element: <CollectionsTabRoute />,
        handle: { tab: 'Collections' },
      },
      {
        path: 'for-you',
        element: <ForYouTabRoute />,
        handle: { tab: 'For You' },
      },
      {
        path: 'bookmarks',
        element: <BookmarksTabRoute />,
        handle: { tab: 'Bookmarks' },
      },
      {
        path: 'tags',
        element: <TagsTabRoute />,
        handle: { tab: 'Tags' },
      },
      {
        path: 'users',
        element: <UsersTabRoute />,
        handle: { tab: 'Users' },
      },
      {
        path: 'admin-settings',
        element: <CollectionsTabRoute />,
        handle: { tab: 'Admin Settings' },
      },
      {
        path: 'profile',
        element: <ProfileRoute />,
        handle: { tab: 'Profile' },
      },
      {
        path: '*',
        element: <Navigate to="home" replace />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export default router;
