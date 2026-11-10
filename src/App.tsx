import { useState, useEffect } from 'react';
import { LoginView } from './components/LoginView';
import type { AuthenticatedUser } from './components/LoginView';
import { TechnicianPortal } from './components/TechnicianPortal';
import { AdminDashboard } from './components/AdminDashboard';

const AUTH_TOKEN_KEY = 'makkah_we_auth_token';
const AUTH_USER_KEY = 'makkah_we_current_user';

export default function App() {
  // Restore persisted session from localStorage so reloading never logs the user out
  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  });

  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_USER_KEY);
      return saved ? (JSON.parse(saved) as AuthenticatedUser) : null;
    } catch {
      return null;
    }
  });

  // Verify active session with backend on load without clearing on transient network blips
  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          handleLogout();
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (data?.user) {
            setCurrentUser(data.user);
            try {
              localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
            } catch {
              // Ignore storage quota errors
            }
          }
        }
      } catch {
        // Keep persisted session active if offline or network is temporarily busy
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const handleLoginSuccess = (token: string, user: AuthenticatedUser) => {
    setAuthToken(token);
    setCurrentUser(user);
    try {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } catch {
      // Ignore storage errors
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <div dir="rtl" lang="ar" className="min-h-screen bg-slate-50 text-slate-900">
      {!authToken || !currentUser ? (
        <LoginView onLoginSuccess={handleLoginSuccess} />
      ) : currentUser.role === 'technician' ? (
        <TechnicianPortal token={authToken} user={currentUser} onLogout={handleLogout} />
      ) : (
        <AdminDashboard token={authToken} user={currentUser} onLogout={handleLogout} />
      )}
    </div>
  );
}
