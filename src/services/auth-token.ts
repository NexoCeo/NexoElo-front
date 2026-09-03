export type AuthSession = {
  qrCode?: string;
  usuario?: unknown;
};

const QR_CODE_KEY = "qrCode";
const USER_KEY = "usuario";

export function saveAuthSession({ qrCode, usuario }: AuthSession) {
  if (qrCode) sessionStorage.setItem(QR_CODE_KEY, qrCode);
  if (usuario) sessionStorage.setItem(USER_KEY, JSON.stringify(usuario));
}

export function getStoredQrCode() {
  return sessionStorage.getItem(QR_CODE_KEY);
}

export function getStoredUser<T = unknown>() {
  const storedUser = sessionStorage.getItem(USER_KEY);
  if (!storedUser) return null;

  try {
    return JSON.parse(storedUser) as T;
  } catch {
    sessionStorage.removeItem(USER_KEY);
    return null;
  }
}

export function clearAuthSession() {
  sessionStorage.removeItem(QR_CODE_KEY);
  sessionStorage.removeItem(USER_KEY);
}
