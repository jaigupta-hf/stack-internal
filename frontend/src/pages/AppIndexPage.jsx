import { useNavigate } from 'react-router-dom';
import Login from './LoginPage';
import TeamsPage from './TeamsPage';
import { useAuth } from '../context/AuthContext';
import { useTeam } from '../context/TeamContext';
import { useUI } from '../context/UIContext';

function AppIndexPage() {
  const navigate = useNavigate();
  const { user, loading, setUser } = useAuth();
  const {
    setActiveTeam,
    setActiveTab,
    setIsTeamMember,
    setIsTeamAdmin,
    setJoinTeamError,
    setForYouUnreadCount,
  } = useTeam();
  const { setTeamSwitcherOpen } = useUI();

  const resetTeamScope = () => {
    setActiveTeam(null);
    setActiveTab('Home');
    setIsTeamMember(true);
    setIsTeamAdmin(false);
    setJoinTeamError('');
    setForYouUnreadCount(0);
    setTeamSwitcherOpen(false);
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    resetTeamScope();
    setUser(null);
  };

  const handleTeamOpen = (team) => {
    setActiveTeam(team);
    setActiveTab('Home');
    setIsTeamMember(true);
    setIsTeamAdmin(Boolean(team.is_admin));
    setJoinTeamError('');
    setForYouUnreadCount(0);
    setTeamSwitcherOpen(false);
    navigate(`/${team.url_endpoint}/home`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-xl text-slate-200">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return <TeamsPage onLogout={handleLogout} onTeamOpen={handleTeamOpen} />;
}

export default AppIndexPage;
