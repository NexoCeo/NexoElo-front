import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "@/test/render-with-notifications";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Agendamento } from "@/types/agendamento";

const agendaServiceMock = vi.hoisted(() => ({
  listarAgendaPorData: vi.fn(),
  atualizarStatusAgendamento: vi.fn(),
  concluirAgendamentosDoDiaAtual: vi.fn(),
}));

const realtimeMock = vi.hoisted(() => ({
  onAgendaUpdated: undefined as ((event: { Data?: string; data?: string }) => void) | undefined,
  onStatusChange: undefined as ((status: "connecting" | "connected" | "reconnecting" | "offline") => void) | undefined,
  start: vi.fn(),
  stop: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: "#212121",
        text: "#ffffff",
      },
    },
  }),
}));

vi.mock("@/context/UserContext", () => ({
  useUser: () => ({
    usuario: { Id: 7, Nome: "Empresa Teste", Papel: "EMPRESA" },
  }),
}));

vi.mock("@/services/agendamento-service", () => ({
  formatAgendaDateParam: (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },
  listarAgendaPorData: agendaServiceMock.listarAgendaPorData,
  atualizarStatusAgendamento: agendaServiceMock.atualizarStatusAgendamento,
  concluirAgendamentosDoDiaAtual: agendaServiceMock.concluirAgendamentosDoDiaAtual,
}));

vi.mock("@/services/agenda-realtime-service", () => ({
  createAgendaRealtimeClient: (options: {
    onAgendaUpdated: (event: { Data?: string; data?: string }) => void;
    onStatusChange: (status: "connecting" | "connected" | "reconnecting" | "offline") => void;
  }) => {
    realtimeMock.onAgendaUpdated = options.onAgendaUpdated;
    realtimeMock.onStatusChange = options.onStatusChange;

    return {
      start: realtimeMock.start,
      stop: realtimeMock.stop,
    };
  },
}));

vi.mock("@/services/profissional-service", () => ({
  listarProfissionaisEmpresa: vi.fn().mockResolvedValue([]),
}));

import Agenda from "./index";

function appointment(overrides: Partial<Agendamento> = {}): Agendamento {
  return {
    Id: 6,
    ClienteId: 4,
    ProfissionalId: 9,
    EmpresaId: 7,
    ServicoId: 2,
    DataAgendamento: "2026-08-10T08:00:00",
    Valor: 150,
    Taxa: 0,
    ValorServico: 150,
    Status: "AGENDADO",
    ClienteNome: "Vitor Cliente",
    ServicoNome: "Serviço Teste 1",
    ProfissionalNome: "Profissional Teste",
    ...overrides,
  };
}

describe("Agenda", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.setSystemTime(new Date(2026, 7, 10, 10, 0, 0));
    agendaServiceMock.listarAgendaPorData.mockReset();
    agendaServiceMock.atualizarStatusAgendamento.mockReset();
    agendaServiceMock.concluirAgendamentosDoDiaAtual.mockReset();
    agendaServiceMock.concluirAgendamentosDoDiaAtual.mockResolvedValue(0);
    realtimeMock.start.mockClear();
    realtimeMock.stop.mockClear();
    realtimeMock.onAgendaUpdated = undefined;
    realtimeMock.onStatusChange = undefined;
  });

  it("carrega e exibe os agendamentos do dia atual com os nomes resolvidos", async () => {
    agendaServiceMock.listarAgendaPorData.mockResolvedValue([appointment()]);

    render(<Agenda />);

    expect(await screen.findByText("Vitor Cliente")).toBeInTheDocument();
    expect(screen.getByText("Serviço Teste 1")).toBeInTheDocument();
    expect(screen.getByText("Profissional Teste")).toBeInTheDocument();
    expect(screen.getByText("08:00")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*150,00/)).toBeInTheDocument();
    expect(agendaServiceMock.listarAgendaPorData).toHaveBeenCalledWith(
      7,
      "2026-08-10",
      undefined,
      expect.any(AbortSignal),
    );
  });

  it("busca somente o novo dia quando o usuario seleciona outra data", async () => {
    agendaServiceMock.listarAgendaPorData
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        appointment({
          Id: 7,
          DataAgendamento: "2026-08-16T14:30:00",
          ClienteNome: "Cliente do Dia 16",
        }),
      ]);

    render(<Agenda />);

    await waitFor(() => {
      expect(agendaServiceMock.listarAgendaPorData).toHaveBeenCalledWith(
        7,
        "2026-08-10",
        undefined,
        expect.any(AbortSignal),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "16 de agosto de 2026" }));

    expect(await screen.findByText("Cliente do Dia 16")).toBeInTheDocument();
    expect(agendaServiceMock.listarAgendaPorData).toHaveBeenLastCalledWith(
      7,
      "2026-08-16",
      undefined,
      expect.any(AbortSignal),
    );
    expect(screen.getByRole("heading", { name: /domingo, 16 de agosto de 2026/i })).toBeInTheDocument();
  });

  it("atualiza silenciosamente assim que recebe o evento da agenda", async () => {
    agendaServiceMock.listarAgendaPorData
      .mockResolvedValueOnce([appointment()])
      .mockResolvedValueOnce([
        appointment(),
        appointment({
          Id: 8,
          DataAgendamento: "2026-08-10T09:15:00",
          ClienteNome: "Novo Cliente",
        }),
      ]);

    render(<Agenda />);
    expect(await screen.findByText("Vitor Cliente")).toBeInTheDocument();

    await act(async () => {
      realtimeMock.onStatusChange?.("connected");
      realtimeMock.onAgendaUpdated?.({ Data: "2026-08-10" });
    });

    expect(await screen.findByText("Novo Cliente")).toBeInTheDocument();
    expect(screen.getByText("Ao vivo")).toBeInTheDocument();
    expect(screen.getByText("2 agendamentos")).toBeInTheDocument();
    expect(screen.queryByText("Carregando agendamentos...")).not.toBeInTheDocument();
  });

  it("ignora eventos de outro dia e atualiza ao usar o controle manual", async () => {
    agendaServiceMock.listarAgendaPorData
      .mockResolvedValueOnce([appointment()])
      .mockResolvedValueOnce([
        appointment(),
        appointment({ Id: 9, ClienteNome: "Atualização Manual" }),
      ]);

    render(<Agenda />);
    expect(await screen.findByText("Vitor Cliente")).toBeInTheDocument();

    act(() => {
      realtimeMock.onAgendaUpdated?.({ Data: "2026-08-11" });
    });
    expect(agendaServiceMock.listarAgendaPorData).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Atualizar agenda" }));
    expect(await screen.findByText("Atualização Manual")).toBeInTheDocument();
  });

  it("mantem a agenda atualizada pelo intervalo de seguranca", async () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10, 10, 0, 0));
    agendaServiceMock.listarAgendaPorData
      .mockResolvedValueOnce([appointment()])
      .mockResolvedValueOnce([
        appointment(),
        appointment({ Id: 10, ClienteNome: "Cliente do Polling" }),
      ]);

    render(<Agenda />);
    await act(async () => undefined);
    expect(screen.getByText("Vitor Cliente")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(screen.getByText("Cliente do Polling")).toBeInTheDocument();
    expect(screen.queryByText("Carregando agendamentos...")).not.toBeInTheDocument();
  });

  it("exibe sete dias no modo semanal e continua consultando o dia selecionado", async () => {
    agendaServiceMock.listarAgendaPorData
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        appointment({
          Id: 13,
          DataAgendamento: "2026-08-11T09:15:00",
          ClienteNome: "Cliente de Terça",
        }),
      ]);

    render(<Agenda />);

    await waitFor(() => {
      expect(agendaServiceMock.listarAgendaPorData).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Semanal" }));

    expect(screen.getByText("Semana")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /segunda-feira, 10 de agosto de 2026/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /domingo, 16 de agosto de 2026/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /terça-feira, 11 de agosto de 2026/i }));

    expect(await screen.findByText("Cliente de Terça")).toBeInTheDocument();
    expect(agendaServiceMock.listarAgendaPorData).toHaveBeenLastCalledWith(
      7,
      "2026-08-11",
      undefined,
      expect.any(AbortSignal),
    );
  });

  it("permite cancelar um agendamento individual pela agenda", async () => {
    const scheduled = appointment();
    agendaServiceMock.listarAgendaPorData.mockResolvedValue([scheduled]);
    agendaServiceMock.atualizarStatusAgendamento.mockResolvedValue({
      ...scheduled,
      Status: "CANCELADO",
    });

    render(<Agenda />);
    expect(await screen.findByText("Vitor Cliente")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar agendamento de Vitor Cliente" }));

    await waitFor(() => {
      expect(agendaServiceMock.atualizarStatusAgendamento).toHaveBeenCalledWith(6, "CANCELADO");
    });
    expect(await screen.findByText("Agendamento cancelado.")).toBeInTheDocument();
    expect(screen.getByText("CANCELADO")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar agendamento de Vitor Cliente" })).not.toBeInTheDocument();
  });

  it("conclui todos os agendamentos do dia atual", async () => {
    agendaServiceMock.listarAgendaPorData.mockResolvedValue([appointment()]);
    agendaServiceMock.concluirAgendamentosDoDiaAtual.mockResolvedValue(2);

    render(<Agenda />);
    expect(await screen.findByText("Vitor Cliente")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar todos agendamentos" }));

    await waitFor(() => {
      expect(agendaServiceMock.concluirAgendamentosDoDiaAtual).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("2 agendamentos concluídos.")).toBeInTheDocument();
  });
});
