import axios from "axios";
import { clearAuthSession } from "./auth-token";
import { clearClienteFinalSession } from "./cliente-final-auth-token";

/*
 * As chamadas do navegador usam o mesmo domínio do frontend.
 *
 * Produção:
 * https://nexoelo.nexoceo.com.br/api/...
 *
 * A Vercel encaminha internamente para:
 * https://nexoelo.onrender.com/api/...
 */
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
