import { getStoredQrCode, getStoredUser } from "./auth-token";

export function autoLogin() {
  const usuario = getStoredUser();

  if (!usuario) {
    return null;
  }

  return {
    qrCode: getStoredQrCode(),
    usuario,
  };
}
