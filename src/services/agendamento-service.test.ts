import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("./api", () => ({
  default: {
    get: mocks.get,
    post: mocks.post,
    patch: mocks.patch,
  },
}));

import {
  atualizarStatusAgendamento,
  concluirAgendamentosDoDiaAtual,
  criarAgendamento,
  listarHistoricoAgendamentos,
  listarHorariosDisponiveis,
  listarProfissionaisAgendamento,
  listarResponsaveisAgendamento,
} from "./agendamento-service";

describe("agendamento-service security contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("usa somente o catalogo publico minimo de prestadores", async () => {
    mocks.get.mockResolvedValue({
      data: [{ Id: 7, Nome: "Empresa", TipoUsuario: "EMPRESA", Slug: "empresa", FotoPerfil: "uploads/empresa.png" }],
    });

    const result = await listarResponsaveisAgendamento();

    expect(mocks.get).toHaveBeenCalledWith("/AgendaPublica/prestadores");
    expect(result).toHaveLength(1);
    expect(result[0].FotoPerfil).toBe("uploads/empresa.png");
  });

  it("usa a lista publica sem contato dos profissionais", async () => {
    mocks.get.mockResolvedValue({
      data: [{ Id: 9, Nome: "Profissional", VinculoStatus: "APROVADO", FotoPerfil: "uploads/profissional.png" }],
    });

    const result = await listarProfissionaisAgendamento(7);

    expect(mocks.get).toHaveBeenCalledWith("/AgendaPublica/empresa/7/profissionais");
    expect(result).toHaveLength(1);
    expect(result[0].FotoPerfil).toBe("uploads/profissional.png");
  });

  it("usa o cookie de sessao ao criar agendamento", async () => {
    mocks.post.mockResolvedValue({ data: { Id: 42 } });
    const payload = {
      ClienteId: 4,
      ResponsavelId: 7,
      ProfissionalId: 9,
      ServicoId: 2,
      DataAgendamento: "2026-08-20T12:00:00.000Z",
    };

    await criarAgendamento(payload);

    expect(mocks.post).toHaveBeenCalledWith("/Agendamento", payload);
  });

  it("consulta os horarios validados para profissional, servico e data", async () => {
    mocks.get.mockResolvedValue({
      data: [
        { DataAgendamento: "2026-08-20T08:00:00", Horario: "08:00" },
        { dataAgendamento: "2026-08-20T08:30:00", horario: "08:30" },
      ],
    });

    const params = {
      responsavelId: 7,
      profissionalId: 9,
      servicoId: 2,
      data: "2026-08-20",
    };
    const result = await listarHorariosDisponiveis(params);

    expect(mocks.get).toHaveBeenCalledWith("/Agendamento/horarios-disponiveis", {
      params,
    });
    expect(result.map((horario) => horario.Horario)).toEqual(["08:00", "08:30"]);
  });

  it("consulta o historico do cliente autenticado", async () => {
    mocks.get.mockResolvedValue({
      data: [{ Id: 12, ClienteId: 4, ServicoNome: "Corte", Status: "AGENDADO" }],
    });

    const result = await listarHistoricoAgendamentos(4);

    expect(mocks.get).toHaveBeenCalledWith("/Agendamento/historico/4");
    expect(result).toHaveLength(1);
    expect(result[0].ServicoNome).toBe("Corte");
  });

  it("atualiza o status pelo endpoint autenticado do agendamento", async () => {
    mocks.patch.mockResolvedValue({
      data: { Id: 12, ClienteId: 4, ServicoId: 2, Status: "CANCELADO" },
    });

    const result = await atualizarStatusAgendamento(12, "CANCELADO");

    expect(mocks.patch).toHaveBeenCalledWith(
      "/Agendamento/12/status",
      { status: "CANCELADO" },
    );
    expect(result.Status).toBe("CANCELADO");
  });

  it("conclui os agendamentos do dia atual e normaliza a quantidade", async () => {
    mocks.patch.mockResolvedValue({ data: { quantidade: 3 } });

    const result = await concluirAgendamentosDoDiaAtual();

    expect(mocks.patch).toHaveBeenCalledWith(
      "/Agendamento/status/concluir-dia-atual",
    );
    expect(result).toBe(3);
  });
});
