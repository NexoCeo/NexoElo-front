import api from "./api";
import { clearAuthSession } from "./auth-token";
import { clearClienteFinalSession } from "./cliente-final-auth-token";

const PROVIDER_TOKEN_KEY = "accessToken";
const PROVIDER_USER_KEY = "usuario";
const CLIENT_TOKEN_KEY = "clienteFinalAccessToken";
const CLIENT_USER_KEY = "clienteFinal";
const QR_CODE_KEY = "qrCode";
const THEME_KEY = "theme";

function sanitizeStoredUser(storedUser: string | null) {
  if (!storedUser) return null;

  try {
    const user = JSON.parse(storedUser) as Record<string, unknown>;
    delete user.accessToken;
    delete user.qrCode;
    return JSON.stringify(user);
  } catch {
    return null;
  }
}

export async function migrateLegacyAuthSession() {
  const providerToken = localStorage.getItem(PROVIDER_TOKEN_KEY);
  const clientToken = localStorage.getItem(CLIENT_TOKEN_KEY);
  const providerUser = sanitizeStoredUser(localStorage.getItem(PROVIDER_USER_KEY));
  const clientUser = sanitizeStoredUser(localStorage.getItem(CLIENT_USER_KEY));
  const qrCode = localStorage.getItem(QR_CODE_KEY);
  const theme = localStorage.getItem(THEME_KEY);
  const token = providerToken || clientToken;

  if (theme) sessionStorage.setItem(THEME_KEY, theme);
  if (providerToken && providerUser) {
    sessionStorage.setItem(PROVIDER_USER_KEY, providerUser);
    if (qrCode) sessionStorage.setItem(QR_CODE_KEY, qrCode);
  } else if (clientToken && clientUser) {
    sessionStorage.setItem(CLIENT_USER_KEY, clientUser);
  }

  try {
    if (token) {
      await api.post("/Auth/MigrarSessao", undefined, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch {
    clearAuthSession();
    clearClienteFinalSession();
  } finally {
    localStorage.clear();
  }
}
