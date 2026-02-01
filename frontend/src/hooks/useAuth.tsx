import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../services/api';

interface User {
 id: string;
 username: string;
 email: string;
 role: string;
}

interface AuthContextType {
 user: User | null;
 loading: boolean;
 login: (username: string, password: string) => Promise<void>;
 register: (username: string, email: string, password: string) => Promise<void>;
 logout: () => void;
 isAuthenticated: boolean;
 authDisabled: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default admin user when auth is disabled
const defaultAdminUser: User = {
 id: '1',
 username: 'admin',
 email: 'admin@localhost',
 role: 'admin'
};

export function AuthProvider({ children }: { children: ReactNode }) {
 // Initialize from localStorage for immediate render
 const [user, setUser] = useState<User | null>(() => {
  const saved = localStorage.getItem('user');
  const token = localStorage.getItem('auth_token');
  if (token === 'auth-disabled' && saved) {
   return JSON.parse(saved);
  }
  if (token && saved && token !== 'auth-disabled') {
   return JSON.parse(saved);
  }
  return null;
 });
 const [loading, setLoading] = useState(true);
 const [authDisabled, setAuthDisabled] = useState(() => {
  return localStorage.getItem('auth_token') === 'auth-disabled';
 });

 useEffect(() => {
  let cancelled = false;
  
  const checkAuthStatus = async () => {
   try {
    const response = await fetch('/api/auth/status');
    const data = await response.json();
    
    if (cancelled) return;
    
    if (data.authDisabled) {
     setAuthDisabled(true);
     setUser(defaultAdminUser);
     localStorage.setItem('auth_token', 'auth-disabled');
     localStorage.setItem('user', JSON.stringify(defaultAdminUser));
     setLoading(false);
     return;
    }
    
    // Auth is enabled - clear any stale auth-disabled token
    if (localStorage.getItem('auth_token') === 'auth-disabled') {
     localStorage.removeItem('auth_token');
     localStorage.removeItem('user');
     setUser(null);
    }
   } catch (error) {
    console.log('Could not check auth status, assuming auth enabled');
   }

   if (cancelled) return;

   // Auth is enabled, check for existing token
   const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
   const savedUser = localStorage.getItem('user');

   if (token && savedUser && token !== 'auth-disabled') {
    try {
     const userData = await api.getMe();
     if (!cancelled) {
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
     }
    } catch {
     if (!cancelled) {
      localStorage.removeItem('token');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      setUser(null);
     }
    }
   }
   
   if (!cancelled) {
    setLoading(false);
   }
  };

  checkAuthStatus();
  
  return () => {
   cancelled = true;
  };
 }, []);

 const login = async (username: string, password: string) => {
  const data = await api.login(username, password);
  localStorage.setItem('token', data.token);
  localStorage.setItem('auth_token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  setUser(data.user);
 };

 const register = async (username: string, email: string, password: string) => {
  const data = await api.register(username, email, password);
  localStorage.setItem('token', data.token);
  localStorage.setItem('auth_token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  setUser(data.user);
 };

 const logout = () => {
  // Don't allow logout if auth is disabled
  if (authDisabled) return;
  
  localStorage.removeItem('token');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
  setUser(null);
 };

 return (
  <AuthContext.Provider value={{
   user,
   loading,
   login,
   register,
   logout,
   isAuthenticated: !!user,
   authDisabled
  }}>
   {children}
  </AuthContext.Provider>
 );
}

export function useAuth() {
 const context = useContext(AuthContext);
 if (context === undefined) {
  throw new Error('useAuth must be used within an AuthProvider');
 }
 return context;
}
