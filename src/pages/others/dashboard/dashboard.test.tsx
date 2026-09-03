import { fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "@/test/render-with-notifications";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const agendaMocks = vi.hoisted(() => ({
  listarPorData: vi.fn(),
  listarPorPeriodo: vi.fn(),
}));

vi.mock("@/services/agendamento-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/agendamento-service")>();
  return {
    ...actual,
    listarAgendaPorData: agendaMocks.listarPorData,
    listarAgendaPorPeriodo: agendaMocks.listarPorPeriodo,
  };
});

vi.mock("@/services/agenda-realtime-service", () => ({
  createAgendaRealtimeClient: () => ({
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: "#212121",
        text: "#ffffff",
        inactive: "#aaaaaa",
      },
    },
  }),
}));

import Dashboard from "./index";

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    sessionStorage.clear();
    agendaMocks.listarPorData.mockReset().mockResolvedValue([]);
    agendaMocks.listarPorPeriodo.mockReset().mockResolvedValue([]);
  });

  it("organiza a agenda profissional sem exibir o seletor de tema", async () => {
    sessionStorage.setItem("usuario", JSON.stringify({ Id: 8, Papel: "PROFISSIONAL" }));
    renderDashboard();

    expect(screen.getByRole("heading", { name: "Dashboard Profissional" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agendamentos de hoje" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hoje" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/^Tema:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Agenda publica")).not.toBeInTheDocument();
    expect(screen.queryByText("Link de agendamento")).not.toBeInTheDocument();
    expect(screen.queryByTitle("QR Code da agenda publica")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(agendaMocks.listarPorData).toHaveBeenCalledWith(8, expect.any(String));
    });

    fireEvent.click(screen.getByRole("button", { name: "Esta semana" }));

    await waitFor(() => {
      expect(agendaMocks.listarPorPeriodo).toHaveBeenCalledWith(
        8,
        expect.any(String),
        expect.any(String),
      );
    });
    expect(screen.getByRole("heading", { name: "Compromissos desta semana" })).toBeInTheDocument();
  });

  it.each([
    ["EMPRESA", "Dashboard da Empresa", "/empresa/agenda"],
    ["AUTONOMO", "Dashboard do Autônomo", "/autonomo/agenda"],
  ])(
    "exibe os agendamentos de hoje e o acesso a agenda para %s",
    async (papel, titulo, agendaPath) => {
      sessionStorage.setItem("usuario", JSON.stringify({ Id: 7, Papel: papel }));
      agendaMocks.listarPorData.mockResolvedValue([
        {
          Id: 42,
          ClienteId: 3,
          ProfissionalId: 8,
          EmpresaId: 7,
          ServicoId: 2,
          DataAgendamento: new Date().toISOString(),
          Valor: 0,
          Taxa: 0,
          ValorServico: 85,
          Status: "AGENDADO",
          ClienteNome: "Cliente de hoje",
          ServicoNome: "Corte",
          ProfissionalNome: "Profissional Teste",
        },
      ]);

      renderDashboard();

      expect(screen.getByRole("heading", { name: titulo })).toBeInTheDocument();
      expect(await screen.findByText("Cliente de hoje")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Abrir agenda" })).toHaveAttribute(
        "href",
        agendaPath,
      );
      expect(screen.queryByRole("button", { name: "Esta semana" })).not.toBeInTheDocument();
      expect(agendaMocks.listarPorData).toHaveBeenCalledWith(7, expect.any(String));
    },
  );
});
