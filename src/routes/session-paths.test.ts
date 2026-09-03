import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { saveAuthSession } from "@/services/auth-token";
import { saveClienteFinalSession } from "@/services/cliente-final-auth-token";

import {
  getAuthenticatedHomePath,
  getEntryPath,
} from "./session-paths";

describe("session entry paths", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it(
    "envia visitantes sem sessão para o login global",
    () => {
      expect(
        getAuthenticatedHomePath(),
      ).toBeNull();

      expect(getEntryPath()).toBe(
        "/global/login",
      );
    },
  );

  it.each([
    [
      "EMPRESA",
      "/empresa/dashboard",
    ],
    [
      "AUTONOMO",
      "/autonomo/dashboard",
    ],
    [
      "PROFISSIONAL",
      "/profissional/dashboard",
    ],
  ])(
    "envia o papel %s para sua dashboard",
    (Papel, expectedPath) => {
      saveAuthSession({
        usuario: {
          Id: 7,
          Papel,
        },
      });

      expect(getEntryPath()).toBe(
        expectedPath,
      );
    },
  );

  it(
    "aceita TipoUsuario como nome alternativo do papel",
    () => {
      saveAuthSession({
        usuario: {
          Id: 7,
          TipoUsuario: "autonomo",
        },
      });

      expect(getEntryPath()).toBe(
        "/autonomo/dashboard",
      );
    },
  );

  it(
    "envia o cliente autenticado para a home",
    () => {
      saveClienteFinalSession({
        Id: 4,
        Nome: "Cliente",
        Email: "cliente@example.com",
        Telefone: "27999999999",
        TipoUsuario: "CLIENTE",
      });

      expect(getEntryPath()).toBe(
        "/cliente-final/home",
      );
    },
  );

  it(
    "não trata um papel desconhecido como empresa",
    () => {
      saveAuthSession({
        usuario: {
          Id: 7,
          Papel: "DESCONHECIDO",
        },
      });

      expect(getEntryPath()).toBe(
        "/global/login",
      );
    },
  );
});
