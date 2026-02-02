// frontend/src/services/auth.js
const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const ACCESS_KEY  = "access_token";
const REFRESH_KEY = "refresh_token";

export const authService = {
  getAccessToken()  { return localStorage.getItem(ACCESS_KEY);  },
  getRefreshToken() { return localStorage.getItem(REFRESH_KEY); },
  setTokens({ access, refresh }) {
    if (access)  localStorage.setItem(ACCESS_KEY,  access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clearTokens() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
  isAuthenticated() { return !!localStorage.getItem(ACCESS_KEY); },

  async login(username, password) {
    const res = await fetch(`${BASE}/api/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error("bad-credentials");
    const data = await res.json(); // { access, refresh }
    this.setTokens(data);
    return data;
  },

  async refreshAccessToken() {
    const refresh = this.getRefreshToken();
    if (!refresh) throw new Error("no-refresh-token");
    const res = await fetch(`${BASE}/api/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) throw new Error("refresh-failed");
    const data = await res.json();
    if (data?.access)  localStorage.setItem(ACCESS_KEY,  data.access);
    if (data?.refresh) localStorage.setItem(REFRESH_KEY, data.refresh);
    return data?.access;
  },

  logout() {
    this.clearTokens();
    window.location.href = "/login";
  },
};
