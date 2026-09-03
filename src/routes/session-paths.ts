import { getStoredUser } from "@/services/auth-token";
import { getClienteFinalUser } from "@/services/cliente-final-auth-token";

import {
  getRoleDashboardPath,
  normalizeRole,
} from "./role-paths";

type StoredProviderUser = {
  Papel?: string;
  TipoUsuario?: string;
};

export function getAuthenticatedHomePath() {
  /*
   * Verifica primeiro se existe
   * uma sessão de cliente final.
   */
  const cliente = getClienteFinalUser();

  if (
    cliente?.TipoUsuario?.toUpperCase() ===
    "CLIENTE"
  ) {
    return "/cliente-final/home";
  }

  /*
   * Verifica a sessão de empresa,
   * autônomo ou profissional.
   */
  const usuario =
    getStoredUser<StoredProviderUser>();

  const papel = normalizeRole(
    usuario?.Papel ||
      usuario?.TipoUsuario,
  );

  /*
   * Se o papel não for reconhecido,
   * considera que não existe uma
   * sessão válida.
   */
  if (!papel) {
    return null;
  }

  return getRoleDashboardPath(papel);
}

export function getEntryPath() {
  /*
   * Usuário autenticado:
   * retorna a página correspondente.
   *
   * Usuário não autenticado:
   * retorna o login global.
   */
  return (
    getAuthenticatedHomePath() ??
    "/global/login"
  );
}
