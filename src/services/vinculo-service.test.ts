import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
}));
vi.mock("./api", () => ({ default: apiMock }));

import {
  listarHistoricoSolicitacoesVinculo,
  listarSolicitacoesVinculo,
  responderSolicitacaoVinculo,
} from "./vinculo-service";

describe("vínculos profissionais: solicitações e histórico", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mantém a consulta de solicitações pendentes sem alterar o endpoint existente", async () => {
    apiMock.get.mockResolvedValue({ data: [{
      Id: 1,
      ProfissionalId: 17,
      ProfissionalNome: "FELIPE COSTA",
      ProfissionalEmail: "FELIPE@EXEMPLO.COM",
      VinculoStatus: "PENDENTE",
    }] });

    const requests = await listarSolicitacoesVinculo(7);
    expect(apiMock.get).toHaveBeenCalledWith("/vinculos/empresa/7/solicitacoes");
    expect(requests).toEqual([expect.objectContaining({
      VinculoId: 1,
      Nome: "Felipe Costa",
      Email: "felipe@exemplo.com",
      Status: "PENDENTE",
    })]);
  });

  it("obtém histórico de aprovados e recusados com a mesma formatação e data", async () => {
    apiMock.get.mockResolvedValue({ data: [
      {
        Id: 3, ProfissionalId: 18,
        ProfissionalNome: "BARBEIRO TESTE",
        ProfissionalEmail: "BARBEIRO@EXEMPLO.COM",
        VinculoStatus: "APROVADO",
        DataSolicitacao: "2026-11-12T12:00:00",
      },
      {
        Id: 2, ProfissionalId: 19,
        ProfissionalNome: "CARLOS ALMEIDA",
        ProfissionalEmail: "CARLOS@EXEMPLO.COM",
        VinculoStatus: "RECUSADO",
        DataSolicitacao: "2026-11-10T12:00:00",
      },
    ] });

    const history = await listarHistoricoSolicitacoesVinculo(7);
    expect(apiMock.get).toHaveBeenCalledWith("/vinculos/empresa/7/solicitacoes/historico");
    expect(history).toEqual([
      expect.objectContaining({
        VinculoId: 3,
        Nome: "Barbeiro Teste",
        Email: "barbeiro@exemplo.com",
        Status: "APROVADO",
        DataSolicitacao: "2026-11-12T12:00:00",
      }),
      expect.objectContaining({
        VinculoId: 2,
        Nome: "Carlos Almeida",
        Email: "carlos@exemplo.com",
        Status: "RECUSADO",
        DataSolicitacao: "2026-11-10T12:00:00",
      }),
    ]);
  });

  it("aprovar ou recusar mantém a rota original", async () => {
    apiMock.patch.mockResolvedValue({ data: null });
    await responderSolicitacaoVinculo(7, 18, "APROVADO");
    expect(apiMock.patch).toHaveBeenCalledWith(
      "/vinculos/empresa/7/solicitacoes/18",
      { status: "APROVADO" },
    );
  });
});
