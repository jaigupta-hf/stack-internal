import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { authService } from '../services/api';
import { useState } from 'react';

function Login({ onLoginSuccess }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await authService.googleLogin(credentialResponse.credential);
      console.log('Login successful:', response);
      onLoginSuccess(response.user);
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || 'Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google login failed. Please try again.');
  };

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <div className="relative min-h-screen w-full overflow-hidden bg-[#0b1014] text-slate-100">
        <div className="pointer-events-none absolute -left-20 top-[-120px] h-[380px] w-[380px] rounded-full bg-teal-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-28 bottom-[-120px] h-[420px] w-[420px] rounded-full bg-amber-500/20 blur-3xl" />
        <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-[2.25rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-10">
            <div className="mb-8 text-center">
              <p className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-1 text-xs tracking-[0.16em] text-slate-300 uppercase">
                Internal Workspace Access
              </p>
              <h1 className="mb-3 text-4xl font-semibold leading-tight text-white sm:text-5xl">
                Stack Internal
              </h1>
              <p className="mx-auto max-w-md text-sm text-slate-300 sm:text-base">
                Sign in with Google to enter your team space, ask questions, and share trusted knowledge.
              </p>
            </div>

            <div className="space-y-4">
              {error ? (
                <div className="rounded-full border border-rose-400/40 bg-rose-500/15 px-5 py-3 text-center text-sm text-rose-200">
                  {error}
                </div>
              ) : null}

              <div className="flex justify-center rounded-full border border-white/15 bg-black/20 px-4 py-4">
                {loading ? (
                  <div className="text-sm text-slate-300">Signing in...</div>
                ) : (
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    useOneTap
                    theme="filled_black"
                    size="large"
                    text="continue_with"
                    shape="pill"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}

export default Login;
