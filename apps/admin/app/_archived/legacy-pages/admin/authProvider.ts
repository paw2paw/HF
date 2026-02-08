import { AuthProvider } from "react-admin";

export const authProvider: AuthProvider = {
  login: async ({ token }) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) throw new Error("Invalid token");

    const data = await res.json();
    localStorage.setItem("hf_token", data.accessToken);
    localStorage.setItem("hf_role", data.permissions);
  },

  logout: async () => {
    localStorage.removeItem("hf_token");
    localStorage.removeItem("hf_role");
  },

  checkAuth: async () => {
    if (!localStorage.getItem("hf_token")) throw new Error();
  },

  checkError: async () => {},

  getPermissions: async () => {
    return localStorage.getItem("hf_role");
  },

  getIdentity: async () => ({
    id: "me",
    fullName: "HF Admin",
  }),
};
