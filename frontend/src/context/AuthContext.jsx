import { createContext, useContext, useEffect, useState } from "react";
import client from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [username, setUsername] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get("/auth/me")
      .then((res) => {
        setUsername(res.data.username);
        setRole(res.data.role);
      })
      .catch(() => {
        setUsername(null);
        setRole(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(usernameInput, password) {
    const res = await client.post("/auth/login", { username: usernameInput, password });
    setUsername(res.data.username);
    setRole(res.data.role);
  }

  async function logout() {
    await client.post("/auth/logout");
    setUsername(null);
    setRole(null);
  }

  return (
    <AuthContext.Provider value={{ username, role, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
