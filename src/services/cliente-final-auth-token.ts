import type { ClienteFinal } from "@/types/cliente-final";

const CLIENTE_FINAL_USER_KEY = "clienteFinal";

export function saveClienteFinalSession(cliente: ClienteFinal) {
  sessionStorage.setItem(CLIENTE_FINAL_USER_KEY, JSON.stringify(cliente));
}

export function getClienteFinalUser() {
  const storedUser = sessionStorage.getItem(CLIENTE_FINAL_USER_KEY);
  if (!storedUser) return null;

  try {
    return JSON.parse(storedUser) as ClienteFinal;
  } catch {
    sessionStorage.removeItem(CLIENTE_FINAL_USER_KEY);
    return null;
  }
}

export function clearClienteFinalSession() {
  sessionStorage.removeItem(CLIENTE_FINAL_USER_KEY);
}
