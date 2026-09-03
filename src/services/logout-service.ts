import api from "./api";
import { clearAuthSession } from "./auth-token";
import { clearClienteFinalSession } from "./cliente-final-auth-token";

export async function logout() {
  try {
    await api.post("/Auth/Logout");
  } finally {
    clearAuthSession();
    clearClienteFinalSession();
  }
}
