import { AuthProvider } from './AuthContext';
import { TeamProvider } from './TeamContext';
import { UIProvider } from './UIContext';

function AppProviders({ children }) {
  return (
    <AuthProvider>
      <TeamProvider>
        <UIProvider>{children}</UIProvider>
      </TeamProvider>
    </AuthProvider>
  );
}

export default AppProviders;
