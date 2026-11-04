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

/**
 * Transfere o agendamento iniciado como visitante para a sessao autenticada.
 * O redirectTo ja e validado pelo fluxo de login e e usado apenas para identificar
 * a mesma rota de agendamento (inclusive o slug do prestador).
 */
export function transferGuestBookingDraft(redirectTo: string, clienteId: number) {
  const bookingPath = redirectTo.split(/[?#]/, 1)[0];
  const match = /^\/cliente-final\/agendar(?:\/([^/]+))?\/?$/.exec(bookingPath);
  if (!match || !Number.isSafeInteger(clienteId) || clienteId <= 0) return;

  try {
    const scope = match[1] ? decodeURIComponent(match[1]) : "marketplace";
    const guestKey = `nexoelo-booking-draft:guest:${scope}`;
    const userKey = `nexoelo-booking-draft:${clienteId}:${scope}`;
    const guestDraft = sessionStorage.getItem(guestKey);

    if (guestDraft) {
      // O agendamento que motivou o login tem prioridade sobre rascunhos antigos.
      sessionStorage.setItem(userKey, guestDraft);
      sessionStorage.removeItem(guestKey);
    }
  } catch {
    // Bloqueios de armazenamento nao devem impedir o login.
  }
}
