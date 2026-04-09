import { lazy } from 'react';
import { Navigate, useLocation, useOutletContext, useParams } from 'react-router-dom';

const HomeTab = lazy(() => import('../pages/navigationTabs/HomeTab'));
const QuestionTab = lazy(() => import('../pages/navigationTabs/QuestionTab'));
const ArticlesTab = lazy(() => import('../pages/navigationTabs/ArticlesTab'));
const CollectionsTab = lazy(() => import('../pages/navigationTabs/CollectionsTab'));
const ForYouTab = lazy(() => import('../pages/navigationTabs/ForYouTab'));
const BookmarksTab = lazy(() => import('../pages/navigationTabs/BookmarksTab'));
const TagsTab = lazy(() => import('../pages/navigationTabs/TagsTab'));
const UsersTab = lazy(() => import('../pages/navigationTabs/UsersTab'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));

export const preloadTabComponent = (tabSlug) => {
  switch (tabSlug) {
    case 'Home':
      import('../pages/navigationTabs/HomeTab');
      break;
    case 'Questions':
      import('../pages/navigationTabs/QuestionTab');
      break;
    case 'Articles':
      import('../pages/navigationTabs/ArticlesTab');
      break;
    case 'Collections':
    case 'Admin Settings':
      import('../pages/navigationTabs/CollectionsTab');
      break;
    case 'For You':
      import('../pages/navigationTabs/ForYouTab');
      break;
    case 'Bookmarks':
      import('../pages/navigationTabs/BookmarksTab');
      break;
    case 'Tags':
      import('../pages/navigationTabs/TagsTab');
      break;
    case 'Users':
      import('../pages/navigationTabs/UsersTab');
      break;
    case 'Profile':
      import('../pages/ProfilePage');
      break;
    default:
      break;
  }
};

const parseProfileUserId = (userId) => {
  if (!userId || userId === 'me') {
    return null;
  }

  const parsed = Number(userId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export function LegacyProfileRoute() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const profileValue = searchParams.get('profile') || 'me';
  const from = searchParams.get('from');
  const normalizedProfileValue = profileValue === 'me' ? 'me' : String(Number(profileValue) || 'me');
  const fromQuery = from ? `?from=${encodeURIComponent(from)}` : '';

  return <Navigate to={`../users/${normalizedProfileValue}${fromQuery}`} replace />;
}

export function HomeTabRoute() {
  const { onOpenQuestion, onOpenUserProfile } = useOutletContext();

  return <HomeTab onQuestionClick={onOpenQuestion} onOpenUserProfile={onOpenUserProfile} />;
}

export function QuestionTabRoute() {
  const { onOpenUserProfile } = useOutletContext();

  return <QuestionTab onOpenUserProfile={onOpenUserProfile} />;
}

export function ArticlesTabRoute() {
  const { onOpenUserProfile } = useOutletContext();

  return <ArticlesTab onOpenUserProfile={onOpenUserProfile} />;
}

export function CollectionsTabRoute() {
  const { onOpenUserProfile } = useOutletContext();

  return <CollectionsTab onOpenUserProfile={onOpenUserProfile} />;
}

export function ForYouTabRoute() {
  const { onOpenNotificationReference, onOpenUserProfile } = useOutletContext();

  return <ForYouTab onOpenReference={onOpenNotificationReference} onOpenUserProfile={onOpenUserProfile} />;
}

export function BookmarksTabRoute() {
  const { onOpenBookmarkReference, onOpenUserProfile } = useOutletContext();

  return <BookmarksTab onOpenReference={onOpenBookmarkReference} onOpenUserProfile={onOpenUserProfile} />;
}

export function TagsTabRoute() {
  return <TagsTab />;
}

export function UsersTabRoute() {
  const { onOpenUserProfile } = useOutletContext();

  return <UsersTab onOpenUserProfile={onOpenUserProfile} />;
}

export function ProfileRoute() {
  const { userId } = useParams();
  const { onOpenUserProfile, onCloseProfile } = useOutletContext();
  const profileUserId = parseProfileUserId(userId);

  return (
    <ProfilePage
      profileUserId={profileUserId}
      onOpenUserProfile={onOpenUserProfile}
      onClose={onCloseProfile}
    />
  );
}
