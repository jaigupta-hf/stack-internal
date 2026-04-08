import { Suspense, lazy } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';

const HomeTab = lazy(() => import('../pages/navigationTabs/HomeTab'));
const QuestionTab = lazy(() => import('../pages/navigationTabs/QuestionTab'));
const ArticlesTab = lazy(() => import('../pages/navigationTabs/ArticlesTab'));
const CollectionsTab = lazy(() => import('../pages/navigationTabs/CollectionsTab'));
const ForYouTab = lazy(() => import('../pages/navigationTabs/ForYouTab'));
const BookmarksTab = lazy(() => import('../pages/navigationTabs/BookmarksTab'));
const TagsTab = lazy(() => import('../pages/navigationTabs/TagsTab'));
const UsersTab = lazy(() => import('../pages/navigationTabs/UsersTab'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));

function RouteSuspense({ children }) {
  return (
    <Suspense fallback={<p className="text-slate-300">Loading section...</p>}>
      {children}
    </Suspense>
  );
}

const getProfileUserIdFromSearch = (search) => {
  const value = new URLSearchParams(search).get('profile');
  if (!value) {
    return null;
  }

  if (value === 'me') {
    return 'me';
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export function HomeTabRoute() {
  const { onOpenQuestion, onOpenUserProfile } = useOutletContext();

  return (
    <RouteSuspense>
      <HomeTab onQuestionClick={onOpenQuestion} onOpenUserProfile={onOpenUserProfile} />
    </RouteSuspense>
  );
}

export function QuestionTabRoute() {
  const { onOpenUserProfile } = useOutletContext();

  return (
    <RouteSuspense>
      <QuestionTab onOpenUserProfile={onOpenUserProfile} />
    </RouteSuspense>
  );
}

export function ArticlesTabRoute() {
  const { onOpenUserProfile } = useOutletContext();

  return (
    <RouteSuspense>
      <ArticlesTab onOpenUserProfile={onOpenUserProfile} />
    </RouteSuspense>
  );
}

export function CollectionsTabRoute() {
  const { onOpenUserProfile } = useOutletContext();

  return (
    <RouteSuspense>
      <CollectionsTab onOpenUserProfile={onOpenUserProfile} />
    </RouteSuspense>
  );
}

export function ForYouTabRoute() {
  const { onOpenNotificationReference, onOpenUserProfile } = useOutletContext();

  return (
    <RouteSuspense>
      <ForYouTab onOpenReference={onOpenNotificationReference} onOpenUserProfile={onOpenUserProfile} />
    </RouteSuspense>
  );
}

export function BookmarksTabRoute() {
  const { onOpenBookmarkReference, onOpenUserProfile } = useOutletContext();

  return (
    <RouteSuspense>
      <BookmarksTab onOpenReference={onOpenBookmarkReference} onOpenUserProfile={onOpenUserProfile} />
    </RouteSuspense>
  );
}

export function TagsTabRoute() {
  return (
    <RouteSuspense>
      <TagsTab />
    </RouteSuspense>
  );
}

export function UsersTabRoute() {
  const { onOpenUserProfile } = useOutletContext();

  return (
    <RouteSuspense>
      <UsersTab onOpenUserProfile={onOpenUserProfile} />
    </RouteSuspense>
  );
}

export function ProfileRoute() {
  const location = useLocation();
  const { onOpenUserProfile, onCloseProfile } = useOutletContext();
  const profileFromSearch = getProfileUserIdFromSearch(location.search);
  const profileUserId = profileFromSearch === 'me' ? null : profileFromSearch;

  return (
    <RouteSuspense>
      <ProfilePage
        profileUserId={profileUserId}
        onOpenUserProfile={onOpenUserProfile}
        onClose={onCloseProfile}
      />
    </RouteSuspense>
  );
}
