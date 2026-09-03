import axios from "axios";
import { clearAuthSession } from "./auth-token";
import { clearClienteFinalSession } from "./cliente-final-auth-token";

export const API_ORIGIN = (
  import.meta.env.VITE_API_ORIGIN || "https://nexoelo.onrender.com"
).replace(/\/$/, "");

const api = axios.create({
  baseURL: `${API_ORIGIN}/api/`,
  timeout: 20_000,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,

  (error) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401
    ) {
      clearAuthSession();
      clearClienteFinalSession();
    }

    return Promise.reject(error);
  },
);

export default api;
