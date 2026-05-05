import axios from "axios";

/**
 * In dev, use same-origin `/api` so Vite can proxy (avoids CORS / wrong host).
 * In production, call the API host from env.
 */
const baseURL = import.meta.env.DEV
  ? ""
  : import.meta.env.VITE_API_URL || "http://localhost:5050";

export const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
