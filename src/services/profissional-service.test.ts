import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}));
vi.mock("./api", () => ({ default: apiMock }));

import { atualizarProfissionalEmpresa, listarProfissionaisEmpresa } from "./profissional-service";

describe("normalização dos profissionais recebidos do banco", () => {
  beforeEach(() => vi.clearAllMocks());

  it("formata nome, e-mail e status antes de preencher o modal", async () => {
    apiMock.get.mockResolvedValue({
      data: [{
        Id: 9,
        Nome: "FELIPE COSTA",
        Email: "FELIPETESTE@GMAIL.COM",
        Telefone: "27999999999",
        FotoPerfil: "uploads/FELIPE.png",
        TipoUsuario: "profissional",
        VinculoStatus: "aprovado",
      }],
    });

    const professionals = await listarProfissionaisEmpresa(7);
    expect(professionals).toEqual([{
      Id: 9,
      Nome: "Felipe Costa",
      Email: "felipeteste@gmail.com",
      Telefone: "27999999999",
      FotoPerfil: "uploads/FELIPE.png",
      TipoUsuario: "PROFISSIONAL",
      VinculoStatus: "APROVADO",
    }]);
  });

  it("normaliza informações retornadas após salvar, sem modificar o ID", async () => {
    apiMock.put.mockResolvedValue({
      data: {
        Id: 9,
        Nome: "FELIPE COSTA",
        Email: "FELIPETESTE@GMAIL.COM",
        TipoUsuario: "PROFISSIONAL",
      },
    });

    const edited = await atualizarProfissionalEmpresa(9, {
      Nome: "Felipe Costa",
      Email: "FelipeTeste@Gmail.com",
      Telefone: "",
    });

    expect(apiMock.put).toHaveBeenCalledWith(
      "/Usuario/empresa/profissionais/9",
      expect.objectContaining({ Nome: "Felipe Costa", Email: "felipeteste@gmail.com" }),
    );
    expect(edited).toMatchObject({
      Id: 9, Nome: "Felipe Costa", Email: "felipeteste@gmail.com",
    });
  });
});
