import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('echomind_token') || null);
  const [loading, setLoading] = useState(true);

  // Validate token with backend on mount
  useEffect(() => {
    const verifyUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          // Token expired or invalid
          logout();
        }
      } catch (err) {
        console.error('Failed to verify token on mount:', err);
      } finally {
        setLoading(false);
      }
    };

    verifyUser();
  }, [token]);

  const login = async (email, password) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem('echomind_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (name, email, password) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    localStorage.setItem('echomind_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('echomind_token');
    setToken(null);
    setUser(null);
  };

  // Helper fetch function that automatically adds authentication
  const apiFetch = async (url, options = {}) => {
    const headers = { ...options.headers };
    
    // Add token if it exists
    const currentToken = token || localStorage.getItem('echomind_token');
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    // Default to JSON body parsing if passing objects
    if (options.body && !(options.body instanceof FormData) && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const mergedOptions = { ...options, headers };
    
    const response = await fetch(url, mergedOptions);
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        logout(); // Auto-logout on auth failure
      }
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }

    return data;
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    apiFetch
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
