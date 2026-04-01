import { useEffect, useState } from 'react';

import LoginPage from './pages/LoginPage';
import { authService } from './services/api';

function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const loadCurrentUser = async () => {
      if (!authService.isAuthenticated()) {
        setCheckingAuth(false);
        return;
      }

      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch {
        setUser(null);
      } finally {
        setCheckingAuth(false);
      }
    };

    loadCurrentUser();
  }, []);

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6">
          <div className="w-full rounded-3xl border border-slate-800 bg-slate-900/70 p-10 text-center shadow-2xl">
            <p className="text-sm text-slate-300">Checking session...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={setUser} />;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6">
        <div className="w-full rounded-3xl border border-slate-800 bg-slate-900/70 p-10 text-center shadow-2xl">
          <p className="text-xs tracking-[0.2em] text-cyan-300 uppercase">Stack Internal</p>
          <h1 className="mt-3 text-4xl font-semibold">Login Works</h1>
          <p className="mt-3 text-slate-300">Signed in as {user.name || user.email}.</p>
        </div>
      </div>
    </main>
  );
}

export default App
