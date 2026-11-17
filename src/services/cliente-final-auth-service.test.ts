import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  saveClienteFinalSession: vi.fn(),
}));

vi.mock("./api", () => ({
  default: {
    post: mocks.post,
  },
}));

vi.mock("./cliente-final-auth-token", () => ({
  saveClienteFinalSession: mocks.saveClienteFinalSession,
}));

import {
  isValidClienteFinalLogin,
  loginClienteFinal,
} from "./cliente-final-auth-service";

describe("cliente-final-auth-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("autentica o cliente por e-mail normalizado", async () => {
    mocks.post.mockResolvedValue({
      data: {
        usuario: {
          Id: 4,
          Nome: "Cliente Teste",
          Email: "cliente@example.com",
          Telefone: "28993337212",
          TipoUsuario: "CLIENTE",
          FotoPerfil: "uploads/cliente.jpg",
        },
      },
    });

    await loginClienteFinal({ login: " Cliente@Example.com ", senha: "senha-segura" });

    expect(mocks.post).toHaveBeenCalledWith("/Auth/AutenticarUsuario", {
      Login: "cliente@example.com",
      Senha: "senha-segura",
    });
    expect(mocks.saveClienteFinalSession).toHaveBeenCalledWith(expect.objectContaining({
      FotoPerfil: "uploads/cliente.jpg",
    }));
  });

  it("mantém FotoPerfil nulo quando o cliente não possui imagem", async () => {
    mocks.post.mockResolvedValue({ data: { usuario: {
      Id: 4, Nome: "Cliente Teste", Email: "cliente@example.com",
      Telefone: "28993337212", TipoUsuario: "CLIENTE",
    } } });
    await loginClienteFinal({ login: "cliente@example.com", senha: "senha-segura" });
    expect(mocks.saveClienteFinalSession).toHaveBeenCalledWith(expect.objectContaining({ FotoPerfil: null }));
  });

  it("autentica o cliente por telefone normalizado", async () => {
    mocks.post.mockResolvedValue({
      data: {
        usuario: {
          Id: 4,
          Nome: "Cliente Teste",
          Email: "cliente@example.com",
          Telefone: "28993337212",
          TipoUsuario: "CLIENTE",
        },
      },
    });

    await loginClienteFinal({ login: "(28) 99333-7212", senha: "senha-segura" });

    expect(mocks.post).toHaveBeenCalledWith("/Auth/AutenticarUsuario", {
      Login: "28993337212",
      Senha: "senha-segura",
    });
  });

  it.each([
    "cliente@",
    "cliente.example.com",
    "2893337212",
    "00993337212",
  ])("rejeita o identificador invalido %s", async (login) => {
    expect(isValidClienteFinalLogin(login)).toBe(false);
    await expect(loginClienteFinal({ login, senha: "senha-segura" })).rejects.toThrow(
      "Informe um e-mail ou telefone valido.",
    );
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
