import { fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "@/test/render-with-notifications";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "@/context/LanguageContext";
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
      <LanguageProvider><Dashboard /></LanguageProvider>
    </MemoryRouter>,
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    // Determinístico em CI: o idioma do navegador de teste pode ser inglês.
    vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["pt-BR"]);
    sessionStorage.clear();
    agendaMocks.listarPorData.mockReset().mockResolvedValue([]);
    agendaMocks.listarPorPeriodo.mockReset().mockResolvedValue([]);
  });

  it("organiza a agenda profissional sem exibir o seletor de tema", async () => {
    sessionStorage.setItem("usuario", JSON.stringify({ Id: 8, Papel: "PROFISSIONAL" }));
    renderDashboard();

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

  it("mostra somente agendados, excluindo concluídos e cancelados do dashboard", async () => {
    sessionStorage.setItem("usuario", JSON.stringify({ Id: 7, Papel: "EMPRESA" }));
    const base = {
      ClienteId: 3, ProfissionalId: 8, EmpresaId: 7, ServicoId: 2,
      DataAgendamento: new Date().toISOString(), Valor: 0, Taxa: 0, ValorServico: 85,
      ServicoNome: "Corte", ProfissionalNome: "Profissional Teste",
    };
    agendaMocks.listarPorData.mockResolvedValue([
      { ...base, Id: 1, Status: "AGENDADO", ClienteNome: "Cliente ativo" },
      { ...base, Id: 2, Status: "CONCLUIDO", ClienteNome: "Cliente concluído" },
      { ...base, Id: 3, Status: "CANCELADO", ClienteNome: "Cliente cancelado" },
    ]);
    renderDashboard();
    expect(await screen.findByText("Cliente ativo")).toBeInTheDocument();
    expect(screen.queryByText("Cliente concluído")).not.toBeInTheDocument();
    expect(screen.queryByText("Cliente cancelado")).not.toBeInTheDocument();
  });

  it("exibe iniciais quando o cliente não possui foto e inclui ícones de serviço e profissional", async () => {
    sessionStorage.setItem("usuario", JSON.stringify({ Id: 7, Papel: "EMPRESA" }));
    agendaMocks.listarPorData.mockResolvedValue([{
      Id: 3, ClienteId: 12, ClienteNome: "Bianca Pirez",
      ClienteFotoPerfil: null, ProfissionalNome: "Roberta Silva",
      ServicoNome: "Escova e prancha", ServicoId: 5,
      DataAgendamento: new Date().toISOString(),
      ValorServico: 85, Status: "AGENDADO",
    }]);
    renderDashboard();

    expect(await screen.findByText("Bianca Pirez")).toBeInTheDocument();
    expect(screen.getByLabelText("Iniciais de Bianca Pirez")).toHaveTextContent("BP");
    expect(screen.getByText("Escova e prancha").parentElement?.querySelector("svg")).toBeInTheDocument();
    const serviceRow = screen.getByText("Escova e prancha").parentElement;
    const professionalRow = screen.getByText("Roberta Silva").parentElement;
    expect(serviceRow?.querySelector('[class*="mobileAppointmentDetailIcon"] svg')).toBeInTheDocument();
    expect(professionalRow?.querySelector('[class*="mobileAppointmentDetailIcon"] svg')).toBeInTheDocument();
    expect(serviceRow).toHaveClass(expect.stringContaining("mobileAppointmentDetailRow"));
    expect(professionalRow).toHaveClass(expect.stringContaining("mobileAppointmentDetailRow"));
    const nameRow = screen.getByText("Bianca Pirez").parentElement;
    expect(nameRow).toContainElement(screen.getByLabelText("Iniciais de Bianca Pirez"));
    const card = screen.getByText("Bianca Pirez").closest("article");
    expect(card).not.toBeNull();
    const metadata = card?.querySelector('[class*="mobileAppointmentMeta"]');
    expect(metadata).toHaveTextContent("R$");
    expect(metadata).toHaveTextContent(":");
  });

  it("exibe imagem cadastrada quando o cliente possui foto", async () => {
    sessionStorage.setItem("usuario", JSON.stringify({ Id: 7, Papel: "EMPRESA" }));
    agendaMocks.listarPorData.mockResolvedValue([{
      Id: 4, ClienteId: 13, ClienteNome: "Maria Oliveira",
      ClienteFotoPerfil: "uploads/maria.jpg", ProfissionalNome: "Roberta Silva",
      ServicoNome: "Hidratação", ServicoId: 7,
      DataAgendamento: new Date().toISOString(),
      ValorServico: 90, Status: "AGENDADO",
    }]);
    renderDashboard();

    const image = await screen.findByRole("img", { name: "Foto de Maria Oliveira" });
    expect(image).toHaveAttribute("src", expect.stringContaining("/uploads/maria.jpg"));
    expect(screen.queryByLabelText("Iniciais de Maria Oliveira")).not.toBeInTheDocument();
    fireEvent.error(image);
    expect(screen.getByLabelText("Iniciais de Maria Oliveira")).toHaveTextContent("MO");
  });

  it.each([
    ["EMPRESA", "/empresa/agenda"],
    ["AUTONOMO", "/autonomo/agenda"],
    ["PROFISSIONAL", "/profissional/agenda"],
  ])("compartilha a mesma dashboard, card e filtros com o papel %s", async (papel, agendaPath) => {
    sessionStorage.setItem("usuario", JSON.stringify({ Id: 7, Papel: papel }));
    agendaMocks.listarPorData.mockResolvedValue([{
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
    }]);
    renderDashboard();
    expect(screen.getByRole("heading", { name: "Agendamentos de hoje" })).toBeInTheDocument();
    expect(await screen.findByText("Cliente de hoje")).toBeInTheDocument();
    expect(screen.getByText("Corte")).toBeInTheDocument();
    expect(screen.getByText("Profissional Teste")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*85,00/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir agendamento de Cliente de hoje na agenda" }))
      .toHaveAttribute("href", expect.stringContaining(agendaPath + "?data="));
    expect(screen.getByRole("button", { name: "Hoje" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Esta semana" })).toBeInTheDocument();
    expect(agendaMocks.listarPorData).toHaveBeenCalledWith(7, expect.any(String));
    fireEvent.click(screen.getByRole("button", { name: "Esta semana" }));
    await waitFor(() => expect(agendaMocks.listarPorPeriodo).toHaveBeenCalledWith(
      7, expect.any(String), expect.any(String),
    ));
    expect(screen.getByRole("button", { name: "Esta semana" })).toHaveAttribute("aria-pressed", "true");
  });
});
