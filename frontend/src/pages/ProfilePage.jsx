import { useEffect, useState } from 'react';
import { authService } from '../services/api';
import { formatProfileTime } from './profileTabs/utils';
import PostsTab from './profileTabs/tabs/PostsTab';
import TagsTab from './profileTabs/tabs/TagsTab';
import FollowingTab from './profileTabs/tabs/FollowingTab';
import ReputationTab from './profileTabs/tabs/ReputationTab';
import BountiesTab from './profileTabs/tabs/BountiesTab';
import BadgesTab from './profileTabs/tabs/BadgesTab';
import BookmarksTab from './profileTabs/tabs/BookmarksTab';

const PROFILE_NAV_TABS = [
  { key: 'posts', label: 'Posts' },
  { key: 'tags', label: 'Tags' },
  { key: 'following', label: 'Following' },
  { key: 'bookmarks', label: 'Bookmarks' },
  { key: 'reputation', label: 'Reputation' },
  { key: 'bounties', label: 'Bounties' },
  { key: 'badges', label: 'Badges' },
];

const PROFILE_TAB_COMPONENTS = {
  posts: PostsTab,
  tags: TagsTab,
  following: FollowingTab,
  bookmarks: BookmarksTab,
  reputation: ReputationTab,
  bounties: BountiesTab,
  badges: BadgesTab,
};

function ProfilePage({ team, onClose, profileUserId = null, onOpenUserProfile }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('posts');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileEditError, setProfileEditError] = useState('');
  const [profileForm, setProfileForm] = useState({
    name: '',
    title: '',
    about: '',
  });

  useEffect(() => {
    const loadProfile = async () => {
      if (!team?.id) {
        return;
      }

      setLoading(true);
      setError('');

      try {
        const data = await authService.getProfile(team.id, profileUserId);
        setProfile(data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load profile.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [team?.id, profileUserId]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setProfileForm({
      name: profile.name || '',
      title: profile.title || '',
      about: profile.about || '',
    });
  }, [profile]);

  const activities = profile?.activities || [];
  const tagUsages = profile?.tag_usages || [];

  const handleOpenReference = (item) => {
    const referenceId = Number(item?.reference_post_id || 0);
    const referenceType = item?.reference_type || (item?.type_key === 'article' ? 'article' : 'question');
    if (!referenceId) {
      return;
    }

    const basePath = `/${team?.url_endpoint}`;
    const tabPath = referenceType === 'article'
      ? `${basePath}/articles`
      : referenceType === 'collection'
        ? `${basePath}/collections`
        : `${basePath}/questions`;
    const paramKey = referenceType === 'article' ? 'article' : referenceType === 'collection' ? 'collection' : 'question';
    window.history.pushState({}, '', `${tabPath}?${paramKey}=${referenceId}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
    onClose();
  };

  const handleProfileFieldChange = (field, value) => {
    setProfileForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleStartEditProfile = () => {
    if (!profile?.can_edit) {
      return;
    }

    setProfileEditError('');
    setProfileForm({
      name: profile?.name || '',
      title: profile?.title || '',
      about: profile?.about || '',
    });
    setIsEditingProfile(true);
  };

  const handleCancelEditProfile = () => {
    setProfileEditError('');
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    if (!profile?.can_edit) {
      return;
    }

    const cleanName = profileForm.name.trim();
    if (!cleanName) {
      setProfileEditError('Name cannot be empty.');
      return;
    }

    setIsSavingProfile(true);
    setProfileEditError('');

    try {
      const updatedProfile = await authService.updateProfile({
        name: cleanName,
        title: profileForm.title.trim(),
        about: profileForm.about.trim(),
      });

      setProfile((current) => ({
        ...current,
        name: updatedProfile.name,
        title: updatedProfile.title,
        about: updatedProfile.about,
        last_seen: updatedProfile.last_seen || current?.last_seen,
      }));
      setIsEditingProfile(false);
    } catch (err) {
      setProfileEditError(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const renderActiveSection = () => {
    const ActiveTabComponent = PROFILE_TAB_COMPONENTS[activeSection] || PostsTab;
    return (
      <ActiveTabComponent
        team={team}
        profileUserId={profile?.id}
        canEdit={Boolean(profile?.can_edit)}
        activities={activities}
        tagUsages={tagUsages}
        onOpenReference={handleOpenReference}
        onOpenUserProfile={onOpenUserProfile}
        formatProfileTime={formatProfileTime}
      />
    );
  };

  if (loading) {
    return <p className="text-slate-300">Loading profile...</p>;
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">{error}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/0 bg-white/10 px-4 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/20"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/0 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/20"
        >
          Back
        </button>
        <h2 className="text-2xl font-semibold text-white">Profile</h2>
      </div>

      <div className="rounded-3xl border border-white/0 bg-black/0 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {isEditingProfile && profile?.can_edit ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] tracking-[0.12em] text-slate-400 uppercase" htmlFor="profile-name-input">
                    Name
                  </label>
                  <input
                    id="profile-name-input"
                    type="text"
                    value={profileForm.name}
                    onChange={(event) => handleProfileFieldChange('name', event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300/40"
                    maxLength={255}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] tracking-[0.12em] text-slate-400 uppercase" htmlFor="profile-title-input">
                    Title
                  </label>
                  <input
                    id="profile-title-input"
                    type="text"
                    value={profileForm.title}
                    onChange={(event) => handleProfileFieldChange('title', event.target.value)}
                    placeholder="Add your title"
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300/40"
                    maxLength={255}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] tracking-[0.12em] text-slate-400 uppercase" htmlFor="profile-about-input">
                    About
                  </label>
                  <textarea
                    id="profile-about-input"
                    value={profileForm.about}
                    onChange={(event) => handleProfileFieldChange('about', event.target.value)}
                    placeholder="Write something about yourself"
                    rows={4}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300/40"
                  />
                </div>

                {profileEditError ? (
                  <p className="rounded-full border border-rose-400/40 bg-rose-500/15 px-3 py-1 text-xs text-rose-200">
                    {profileEditError}
                  </p>
                ) : null}
              </div>
            ) : (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-3xl font-semibold text-white">{profile?.name}</h3>
                  <span className="rounded-full border border-cyan-300/0 bg-cyan-500/20 px-3 py-1 text-[11px] tracking-[0.1em] text-cyan-200 uppercase">
                    {profile?.membership_type || 'member'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-200">
                  {profile?.title ? `Title: ${profile.title}` : 'No title added yet.'}
                </p>
                <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm text-slate-300">
                  {profile?.about ? `About: ${profile.about}` : 'No about section added yet.'}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {profile?.can_edit && isEditingProfile ? (
              <>
                <button
                  type="button"
                  onClick={handleCancelEditProfile}
                  disabled={isSavingProfile}
                  className="rounded-full border border-white/0 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/20 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="rounded-full border border-cyan-300/0 bg-cyan-400/20 px-3 py-1 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/35 disabled:opacity-60"
                >
                  {isSavingProfile ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : profile?.can_edit ? (
              <button
                type="button"
                onClick={handleStartEditProfile}
                className="rounded-full border border-white/0 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/20"
              >
                Edit
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-slate-200">
            Joined: {formatProfileTime(profile?.team_joined_at)}
          </span>
          <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-slate-200">
            Last seen: {formatProfileTime(profile?.last_seen)}
          </span>
          <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-slate-200">
            User ID: {profile?.id}
          </span>
          <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-slate-200">
            Reputation: {profile?.reputation ?? 1}
          </span>
        </div>
        <div className="mt-3 border-t border-white/15" />
      </div>


      <div className="flex items-start gap-2">
        <aside className="sticky top-4 w-44 shrink-0 rounded-3xl border border-white/0 bg-black/0 p-3 sm:w-40">
          <nav className="space-y-1" aria-label="Profile sections">
            {PROFILE_NAV_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveSection(tab.key)}
                className={`w-full rounded-2xl px-3 py-1 text-left text-xs font-medium transition ${
                  activeSection === tab.key
                    ? 'bg-cyan-300/20 text-cyan-100'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <div>{renderActiveSection()}</div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
