import { createContext, useContext, useState, useEffect } from 'react';
import { authApi, getToken, saveToken, deleteToken } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: restore session from secure store
  useEffect(() => {
    (async () => {
      try {
        const stored = await getToken();
        if (stored) {
          const resp = await authApi.me();
          setToken(stored);
          setUser(resp.data);
        }
      } catch {
        // Token expired or invalid — clear it
        await deleteToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const resp = await authApi.login(email, password);
    await saveToken(resp.data.token);
    setToken(resp.data.token);
    setUser(resp.data.user);
    return resp.data;
  };

  const register = async (email, name, password) => {
    const resp = await authApi.register(email, name, password);
    await saveToken(resp.data.token);
    setToken(resp.data.token);
    setUser(resp.data.user);
    return resp.data;
  };

  const logout = async () => {
    await deleteToken();
    setToken(null);
    setUser(null);
  };

  const forgotPassword = async (email) => {
    await authApi.forgotPassword(email);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, forgotPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
