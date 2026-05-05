import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async (token) => {
    try {
      const { data } = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(data);
    } catch {
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // After Google OAuth the server redirects here with ?token=...
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      localStorage.setItem('token', urlToken);
      window.history.replaceState({}, '', window.location.pathname);
      fetchUser(urlToken);
      return;
    }
    const stored = localStorage.getItem('token');
    if (stored) fetchUser(stored);
    else setLoading(false);
  }, [fetchUser]);

  function login(token) {
    localStorage.setItem('token', token);
    return fetchUser(token);   // returns Promise so callers can await
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  function refresh() {
    const token = localStorage.getItem('token');
    if (token) return fetchUser(token);
    return Promise.resolve();
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
