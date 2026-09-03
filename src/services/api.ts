import axios from "axios";
import { clearAuthSession } from "./auth-token";
import { clearClienteFinalSession } from "./cliente-final-auth-token";

// Keep authenticated HTTP requests first-party. Vite and Vercel proxy these
// paths to the backend, avoiding Safari's third-party cookie restrictions.
export const API_ORIGIN = "";

const api = axios.create({
  baseURL: "/api/",
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
