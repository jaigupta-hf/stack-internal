import { Navigate, createBrowserRouter, useParams } from 'react-router-dom';
import App from './App.jsx';

function TeamSlugRedirect() {
  const { teamSlug } = useParams();
  return <Navigate to={`/${teamSlug}/home`} replace />;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
  },
  {
    path: '/:teamSlug',
    element: <TeamSlugRedirect />,
  },
  {
    path: '/:teamSlug/:tabSlug',
    element: <App />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export default router;
