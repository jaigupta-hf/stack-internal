import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authService, notificationService, teamService } from '../services/api';
import { useAuth } from './AuthContext';

const TeamContext = createContext(undefined);

export function TeamProvider({ children }) {
  const { user } = useAuth();

  const [activeTeam, setActiveTeam] = useState(null);
  const [activeTab, setActiveTab] = useState('Home');
  const [isTeamMember, setIsTeamMember] = useState(true);
  const [isTeamAdmin, setIsTeamAdmin] = useState(false);
  const [joiningTeam, setJoiningTeam] = useState(false);
  const [joinTeamError, setJoinTeamError] = useState('');
  const [joinedTeams, setJoinedTeams] = useState([]);
  const [loadingJoinedTeams, setLoadingJoinedTeams] = useState(false);
  const [forYouUnreadCount, setForYouUnreadCount] = useState(0);
  const [currentTeamReputation, setCurrentTeamReputation] = useState(null);

  useEffect(() => {
    const loadJoinedTeams = async () => {
      if (!user) {
        setJoinedTeams([]);
        return;
      }

      setLoadingJoinedTeams(true);
      try {
        const teams = await teamService.listTeams();
        const list = teams || [];
        const hasIsMemberFlag = list.some((team) => Object.prototype.hasOwnProperty.call(team, 'is_member'));
        setJoinedTeams(hasIsMemberFlag ? list.filter((team) => team.is_member) : list);
      } catch {
        setJoinedTeams((prev) => prev);
      } finally {
        setLoadingJoinedTeams(false);
      }
    };

    loadJoinedTeams();
  }, [user, activeTeam?.id]);

  useEffect(() => {
    const loadCurrentTeamReputation = async () => {
      if (!user || !activeTeam?.id || !isTeamMember) {
        setCurrentTeamReputation(null);
        return;
      }

      try {
        const profile = await authService.getProfile(activeTeam.id);
        setCurrentTeamReputation(Number(profile?.reputation ?? null));
      } catch {
        setCurrentTeamReputation(null);
      }
    };

    loadCurrentTeamReputation();
  }, [user, activeTeam?.id, isTeamMember]);

  useEffect(() => {
    const loadForYouUnreadCount = async () => {
      if (!activeTeam?.id || !isTeamMember) {
        setForYouUnreadCount(0);
        return;
      }

      try {
        const data = await notificationService.list(activeTeam.id);
        setForYouUnreadCount(Number(data.unread_count || 0));
      } catch {
        setForYouUnreadCount(0);
      }
    };

    loadForYouUnreadCount();
  }, [activeTeam?.id, isTeamMember]);

  const value = useMemo(() => ({
    activeTeam,
    setActiveTeam,
    activeTab,
    setActiveTab,
    isTeamMember,
    setIsTeamMember,
    isTeamAdmin,
    setIsTeamAdmin,
    joiningTeam,
    setJoiningTeam,
    joinTeamError,
    setJoinTeamError,
    joinedTeams,
    setJoinedTeams,
    loadingJoinedTeams,
    forYouUnreadCount,
    setForYouUnreadCount,
    currentTeamReputation,
    setCurrentTeamReputation,
  }), [
    activeTeam,
    activeTab,
    isTeamMember,
    isTeamAdmin,
    joiningTeam,
    joinTeamError,
    joinedTeams,
    loadingJoinedTeams,
    forYouUnreadCount,
    currentTeamReputation,
  ]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error('useTeam must be used within TeamProvider');
  }

  return context;
}
