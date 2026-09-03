import { beforeEach, describe, expect, it } from "vitest";
import { clearAuthSession, getStoredUser, saveAuthSession } from "./auth-token";
import {
  clearClienteFinalSession,
  getClienteFinalUser,
  saveClienteFinalSession,
} from "./cliente-final-auth-token";
import api from "./api";

describe("session authentication storage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("stores provider data only in sessionStorage", () => {
    const usuario = { Id: 7, Nome: "Empresa", Papel: "EMPRESA" };

    saveAuthSession({ usuario });

    expect(getStoredUser()).toEqual(usuario);
    expect(sessionStorage.getItem("usuario")).not.toBeNull();
    expect(localStorage.length).toBe(0);

    clearAuthSession();
    expect(getStoredUser()).toBeNull();
  });

  it("stores client data only in sessionStorage", () => {
    const cliente = {
      Id: 4,
      Nome: "Cliente",
      Email: "cliente@example.com",
      Telefone: "27999999999",
      TipoUsuario: "CLIENTE",
    };

    saveClienteFinalSession(cliente);

    expect(getClienteFinalUser()).toEqual(cliente);
    expect(sessionStorage.getItem("clienteFinal")).not.toBeNull();
    expect(localStorage.length).toBe(0);

    clearClienteFinalSession();
    expect(getClienteFinalUser()).toBeNull();
  });

  it("configures the API to send the HttpOnly session cookie", () => {
    expect(api.defaults.withCredentials).toBe(true);
  });
});
