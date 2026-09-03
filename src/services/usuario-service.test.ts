import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}));

vi.mock("./api", () => ({
  default: {
    get: mocks.get,
    put: mocks.put,
  },
}));

import { atualizarPerfilUsuario, obterPerfilUsuario } from "./usuario-service";

describe("usuario-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normaliza o perfil retornado pelo backend", async () => {
    mocks.get.mockResolvedValue({
      data: {
        Id: 7,
        Nome: "Empresa Teste",
        Email: "EMPRESA@MAIL.COM",
        Telefone: "27999999999",
        FotoPerfil: "uploads/empresa.png",
        TipoUsuario: "EMPRESA",
        Slug: "empresa-teste",
      },
    });

    const result = await obterPerfilUsuario(7);

    expect(mocks.get).toHaveBeenCalledWith("/Usuario/7");
    expect(result).toMatchObject({
      Id: 7,
      Papel: "EMPRESA",
      FotoPerfil: "uploads/empresa.png",
    });
  });

  it("envia os dados e a foto do perfil em multipart", async () => {
    const foto = new File(["foto"], "perfil.png", { type: "image/png" });
    mocks.put.mockResolvedValue({
      data: {
        Id: 7,
        Nome: "Novo Nome",
        Email: "NOVO@MAIL.COM",
        TipoUsuario: "AUTONOMO",
      },
    });

    await atualizarPerfilUsuario(7, {
      Nome: "Novo Nome",
      Email: "novo@mail.com",
      Telefone: "27999999999",
      FotoPerfil: foto,
    });

    const [, formData] = mocks.put.mock.calls[0];
    expect(mocks.put).toHaveBeenCalledWith(
      "/Usuario/7/perfil",
      expect.any(FormData),
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    expect(formData.get("Nome")).toBe("Novo Nome");
    expect(formData.get("FotoPerfil")).toBe(foto);
  });
});
