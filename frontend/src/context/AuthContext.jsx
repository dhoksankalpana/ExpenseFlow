
import { useEffect, useState } from "react";
import AuthContext from "./AuthContextValue";
import api, { refreshCsrfToken } from "../services/api";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        await refreshCsrfToken();
        const response = await api.get("/auth/me");

        if (active) {
          setUser(response.data.user);
        }
      } catch {
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    checkSession();

    return () => {
      active = false;
    };
  }, []);

  async function login(email, password) {
    await refreshCsrfToken();

    const response = await api.post("/auth/login", {
      email,
      password,
    });

    setUser(response.data.user);
    return response.data.user;
  }

  async function logout() {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
