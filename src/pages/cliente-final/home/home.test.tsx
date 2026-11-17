import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { render as renderWithNotifications } from "@/test/render-with-notifications";
import { LanguageProvider } from "@/context/LanguageContext";
import type { ReactElement } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listarHistoricoAgendamentos: vi.fn(),
  atualizarStatusAgendamento: vi.fn(),
  consultarPagamentoAgendamento: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/services/agendamento-service", () => ({
  listarHistoricoAgendamentos: mocks.listarHistoricoAgendamentos,
  atualizarStatusAgendamento: mocks.atualizarStatusAgendamento,
}));

vi.mock("@/services/cliente-final-auth-token", () => ({
  getClienteFinalUser: () => ({
    Id: 4,
    Nome: "VITOR CLIENTE",
    Email: "VITOR@EXAMPLE.COM",
    Telefone: "28993337212",
    TipoUsuario: "CLIENTE",
  }),
}));

vi.mock("@/services/logout-service", () => ({
  logout: mocks.logout,
}));

vi.mock("@/services/agenda-realtime-service", () => ({
  createAgendaRealtimeClient: () => ({
    start: () => undefined,
    stop: async () => undefined,
  }),
}));

vi.mock("@/services/pagamentos-agendamento-service", () => ({
  consultarPagamentoAgendamento: mocks.consultarPagamentoAgendamento,
  iniciarPagamentoOnline: vi.fn(),
}));

import ClienteFinalHome from "./index";

function render(ui: ReactElement) {
  return renderWithNotifications(<LanguageProvider>{ui}</LanguageProvider>);
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

describe("ClienteFinalHome", () => {
  beforeEach(() => {
    // O CI pode usar inglês como idioma do navegador: as asserções desta tela são pt-BR.
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      value: ["pt-BR"],
    });
    vi.clearAllMocks();
    mocks.consultarPagamentoAgendamento.mockResolvedValue(null);
    mocks.listarHistoricoAgendamentos.mockResolvedValue([
      {
        Id: 12,
        ClienteId: 4,
        ProfissionalId: 9,
        EmpresaId: 7,
        ServicoId: 2,
        DataAgendamento: "2099-08-20T08:30:00",
        Valor: 50,
        Taxa: 0,
        ValorServico: 50,
        Status: "AGENDADO",
        ClienteNome: "Vitor Cliente",
        ServicoNome: "Corte",
        ProfissionalNome: "Profissional Teste",
      },
      {
        Id: 11,
        ClienteId: 4,
        ProfissionalId: 9,
        EmpresaId: 7,
        ServicoId: 3,
        DataAgendamento: "2020-01-10T14:00:00",
        Valor: 80,
        Taxa: 0,
        ValorServico: 80,
        Status: "CONCLUIDO",
        ClienteNome: "Vitor Cliente",
        ServicoNome: "Barba",
        ProfissionalNome: "Profissional Teste",
      },
    ]);
    mocks.atualizarStatusAgendamento.mockResolvedValue({
      Id: 12,
      ClienteId: 4,
      ProfissionalId: 9,
      EmpresaId: 7,
      ServicoId: 2,
      DataAgendamento: "2099-08-20T08:30:00",
      Valor: 50,
      Taxa: 0,
      ValorServico: 50,
      Status: "CANCELADO",
      ClienteNome: "Vitor Cliente",
      ServicoNome: "Corte",
      ProfissionalNome: "Profissional Teste",
    });
  });

  it("mantém o espaçamento do card após receber pagamento não iniciado", async () => {
    let resolvePayment!: (value: { status: string; valor: number }) => void;
    mocks.consultarPagamentoAgendamento.mockImplementation(
      () => new Promise(resolve => { resolvePayment = resolve; }),
    );

    render(
      <MemoryRouter initialEntries={["/cliente-final/home"]}>
        <ClienteFinalHome />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Corte")).toBeInTheDocument();
    await waitFor(() => expect(resolvePayment).toBeTypeOf("function"));
    expect(screen.queryByTestId("appointment-payment-status")).not.toBeInTheDocument();

    await act(async () => {
      resolvePayment({ status: "NAO_INICIADO", valor: 50 });
    });

    // A div vazia não deve surgir entre métricas e botões após a resposta da API.
    expect(screen.queryByTestId("appointment-payment-status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar agendamento de Corte" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Concluir agendamento de Corte" })).toBeInTheDocument();
  });

  it("exibe informação de pagamento somente quando há conteúdo real", async () => {
    mocks.consultarPagamentoAgendamento.mockResolvedValue({
      status: "PENDENTE", metodo: "PRESENCIAL", valor: 50,
    });

    render(
      <MemoryRouter initialEntries={["/cliente-final/home"]}>
        <ClienteFinalHome />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Pagamento presencial pendente")).toBeInTheDocument();
    expect(screen.getByTestId("appointment-payment-status")).toHaveTextContent("Pagamento presencial pendente");
  });

  it("troca o conteudo pelas abas sem sair da rota home", async () => {
    render(
      <MemoryRouter initialEntries={["/cliente-final/home"]}>
        <ClienteFinalHome />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Olá, Vitor Cliente" }).closest("main")).toBeInTheDocument();
    expect(screen.getByText("NexoCeo").closest("header")).toBeInTheDocument();
    expect(await screen.findByText("Corte")).toBeInTheDocument();
    expect(screen.getByText("Próximos agendamentos")).toBeInTheDocument();
    expect(screen.getByText("Atendimentos concluídos")).toBeInTheDocument();
    expect(screen.getByText("Próximos agendamentos").parentElement).toHaveTextContent("1");
    expect(screen.getByText("Atendimentos concluídos").parentElement).toHaveTextContent("1");
    expect(screen.getByText("Valor total")).toBeInTheDocument();
    expect(screen.getByText("Duração")).toBeInTheDocument();
    expect(screen.getByText("Não informada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar agendamento de Corte" })).toHaveTextContent("Cancelar");
    expect(screen.getByRole("button", { name: "Concluir agendamento de Corte" })).toHaveTextContent("Concluir");
    expect(screen.queryByRole("button", { name: /ver detalhes/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Histórico" }));
    expect(screen.getByRole("heading", { name: "Histórico de Agendamentos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Próximos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Anteriores" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exibir detalhes do agendamento de Corte" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Exibir detalhes do agendamento de Barba" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("location")).toHaveTextContent("/cliente-final/home");

    fireEvent.click(screen.getByRole("tab", { name: "Perfil" }));
    expect(screen.getByRole("tab", { name: "Perfil" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Vitor Cliente" })).toBeInTheDocument();
    expect(screen.getByText("vitor@example.com")).toBeInTheDocument();
    expect(screen.getByText("(28) 99333-7212")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/cliente-final/home");

    await waitFor(() => {
      expect(mocks.listarHistoricoAgendamentos).toHaveBeenCalledWith(4);
    });
  });

  it("filtra o histórico por concluídos e cancelados sem alterar os agendamentos", async () => {
    mocks.listarHistoricoAgendamentos.mockResolvedValue([
      {
        Id: 12, ClienteId: 4, ServicoId: 2, DataAgendamento: "2099-08-20T08:30:00",
        Valor: 50, Taxa: 0, ValorServico: 50, Status: "AGENDADO",
        ClienteNome: "Vitor Cliente", ServicoNome: "Corte",
        ProfissionalNome: "Profissional Teste",
      },
      {
        Id: 13, ClienteId: 4, ServicoId: 3, DataAgendamento: "2020-01-10T14:00:00",
        Valor: 80, Taxa: 0, ValorServico: 80, Status: "CONCLUIDO",
        ClienteNome: "Vitor Cliente", ServicoNome: "Barba",
        ProfissionalNome: "Profissional Teste",
      },
      {
        Id: 14, ClienteId: 4, ServicoId: 4, DataAgendamento: "2020-01-08T12:00:00",
        Valor: 100, Taxa: 0, ValorServico: 100, Status: "CANCELADO",
        ClienteNome: "Vitor Cliente", ServicoNome: "Hidratação",
        ProfissionalNome: "Profissional Teste",
      },
    ]);
    render(
      <MemoryRouter initialEntries={["/cliente-final/home"]}>
        <ClienteFinalHome />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Corte")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Histórico" }));
    const allFilter = screen.getByRole("button", { name: "Todos" });
    const completedFilter = screen.getByRole("button", { name: "Concluídos" });
    const cancelledFilter = screen.getByRole("button", { name: "Cancelados" });
    expect(allFilter).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Exibir detalhes do agendamento de Corte" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Exibir detalhes do agendamento de Barba" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Exibir detalhes do agendamento de Hidratação" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Hidratação")).not.toBeInTheDocument();

    fireEvent.click(completedFilter);
    expect(completedFilter).toHaveAttribute("aria-pressed", "true");
    expect(allFilter).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: /detalhes do agendamento de Corte/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exibir detalhes do agendamento de Barba" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /detalhes do agendamento de Hidratação/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Anteriores" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Próximos" })).not.toBeInTheDocument();

    fireEvent.click(cancelledFilter);
    expect(cancelledFilter).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: /detalhes do agendamento de Barba/ })).not.toBeInTheDocument();
    const cancelledCard = screen.getByRole("button", { name: "Exibir detalhes do agendamento de Hidratação" });
    expect(cancelledCard).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(cancelledCard);
    expect(screen.getByText("Hidratação")).toBeInTheDocument();

    fireEvent.click(allFilter);
    expect(allFilter).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Exibir detalhes do agendamento de Corte" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Exibir detalhes do agendamento de Barba" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Exibir detalhes do agendamento de Hidratação" })).toHaveAttribute("aria-expanded", "false");
    expect(mocks.listarHistoricoAgendamentos).toHaveBeenCalledTimes(1);
  });

  it("informa quando o status selecionado não possui agendamentos", async () => {
    render(
      <MemoryRouter initialEntries={["/cliente-final/home"]}>
        <ClienteFinalHome />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Corte")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Histórico" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelados" }));
    expect(screen.getByText("Nenhum agendamento cancelado")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Próximos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Anteriores" })).not.toBeInTheDocument();
  });

  it("exibe os serviços e os respectivos profissionais ao expandir o histórico", async () => {
    mocks.listarHistoricoAgendamentos.mockResolvedValue([
      {
        Id: 31, ClienteId: 4, ResponsavelId: 7, EmpresaId: 7, ServicoId: 2,
        DataAgendamento: "2026-11-16T12:00:00",
        Valor: 240, ValorServico: 240, Taxa: 0, Status: "CONCLUIDO",
        ClienteNome: "Vitor Cliente",
        ServicoNome: "Escova e prancha + Sobrancelha",
        ProfissionalNome: "Maria Eduarda + Ana Cláudia",
        ServicosDetalhados: [
          { Id: 2, Nome: "Escova e prancha", ProfissionalId: 51, ProfissionalNome: "Maria Eduarda" },
          { Id: 3, Nome: "Sobrancelha", ProfissionalId: 52, ProfissionalNome: "Ana Cláudia" },
        ],
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/cliente-final/home"]}>
        <ClienteFinalHome />
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Atendimentos concluídos").parentElement).toHaveTextContent("1");
    });
    fireEvent.click(screen.getByRole("tab", { name: "Histórico" }));
    const expandInitially = screen.getByRole("button", {
      name: "Exibir detalhes do agendamento de Escova e prancha + Sobrancelha",
    });
    expect(expandInitially).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("heading", { name: "Serviços realizados" })).not.toBeInTheDocument();
    expect(screen.queryByText("Escova e prancha")).not.toBeInTheDocument();
    fireEvent.click(expandInitially);
    expect(screen.getByRole("heading", { name: "Serviços realizados" })).toBeInTheDocument();
    expect(screen.getByText("Escova e prancha")).toBeInTheDocument();
    expect(screen.getByText("Maria Eduarda")).toBeInTheDocument();
    expect(screen.getByText("Sobrancelha")).toBeInTheDocument();
    expect(screen.getByText("Ana Cláudia")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*240,00/)).toBeInTheDocument();

    const collapseButton = screen.getByRole("button", {
      name: "Recolher detalhes do agendamento de Escova e prancha + Sobrancelha",
    });
    expect(collapseButton).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(collapseButton);
    expect(screen.queryByText("Escova e prancha")).not.toBeInTheDocument();
    const expandButton = screen.getByRole("button", {
      name: "Exibir detalhes do agendamento de Escova e prancha + Sobrancelha",
    });
    expect(expandButton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(expandButton);
    expect(screen.getByText("Escova e prancha")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Agendar novamente" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/cliente-final/agendar");
  });

  it("não inclui agendamentos cancelados no resumo de atendimentos concluídos", async () => {
    mocks.listarHistoricoAgendamentos.mockResolvedValue([
      {
        Id: 21,
        ClienteId: 4,
        ServicoId: 1,
        DataAgendamento: "2026-11-15T09:00:00",
        Valor: 40,
        Taxa: 0,
        ValorServico: 40,
        Status: "CANCELADO",
        ClienteNome: "Vitor Cliente",
        ServicoNome: "Corte",
        ProfissionalNome: "Profissional Teste",
      },
      {
        Id: 22,
        ClienteId: 4,
        ServicoId: 2,
        DataAgendamento: "2026-11-16T09:00:00",
        Valor: 80,
        Taxa: 0,
        ValorServico: 80,
        Status: "CONCLUIDO",
        ClienteNome: "Vitor Cliente",
        ServicoNome: "Barba",
        ProfissionalNome: "Profissional Teste",
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/cliente-final/home"]}>
        <ClienteFinalHome />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Atendimentos concluídos").parentElement).toHaveTextContent("1");
    });
    expect(screen.getByText("Próximos agendamentos").parentElement).toHaveTextContent("0");
  });

  it("permite cancelar um agendamento ativo e atualiza o conteudo", async () => {
    render(
      <MemoryRouter initialEntries={["/cliente-final/home"]}>
        <ClienteFinalHome />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Corte")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar agendamento de Corte" }));

    await waitFor(() => {
      expect(mocks.atualizarStatusAgendamento).toHaveBeenCalledWith(12, "CANCELADO");
    });
    expect(await screen.findByText("Agendamento cancelado.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum atendimento agendado")).toBeInTheDocument();
  });

  it("avisa sobre o prazo encerrado sem enviar uma requisicao invalida", async () => {
    mocks.listarHistoricoAgendamentos.mockResolvedValue([
      {
        Id: 12,
        ClienteId: 4,
        ProfissionalId: 9,
        EmpresaId: 7,
        ServicoId: 2,
        DataAgendamento: "2020-08-20T08:30:00",
        Valor: 50,
        Taxa: 0,
        ValorServico: 50,
        Status: "AGENDADO",
        ClienteNome: "Vitor Cliente",
        ServicoNome: "Corte",
        ProfissionalNome: "Profissional Teste",
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/cliente-final/home"]}>
        <ClienteFinalHome />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Histórico" }));
    const expandScheduled = await screen.findByRole("button", { name: "Exibir detalhes do agendamento de Corte" });
    expect(expandScheduled).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(expandScheduled);
    expect(screen.getByText("Corte")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar agendamento de Corte" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Prazo de cancelamento encerrado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar agendamento de Corte" })).toBeInTheDocument();
    expect(mocks.atualizarStatusAgendamento).not.toHaveBeenCalled();
  });

  it("mantém agendamento iniciado entre os próximos enquanto estiver AGENDADO", async () => {
    mocks.listarHistoricoAgendamentos.mockResolvedValue([
      {
        Id: 17, ClienteId: 4, ProfissionalId: 9, EmpresaId: 7, ServicoId: 2,
        DataAgendamento: "2020-08-20T08:30:00",
        Valor: 120, Taxa: 0, ValorServico: 120, Status: "AGENDADO",
        ClienteNome: "Joana Vitória", ServicoNome: "Escova e prancha + Hidratação",
        ProfissionalNome: "Roberta Silva + Maria Eduarda",
      },
    ]);
    render(
      <MemoryRouter initialEntries={["/cliente-final/home"]}>
        <ClienteFinalHome />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Escova e prancha + Hidratação")).toBeInTheDocument();
    expect(screen.getByText("Próximo atendimento")).toBeInTheDocument();
    expect(screen.getByText(/Profissionais:\s*Roberta Silva \+ Maria Eduarda/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Histórico" }));
    expect(screen.getByRole("heading", { name: "Próximos" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Anteriores" })).not.toBeInTheDocument();
  });

  it("move agendamentos finalizados para Anteriores mesmo que a data seja futura", async () => {
    mocks.listarHistoricoAgendamentos.mockResolvedValue([
      {
        Id: 18, ClienteId: 4, ProfissionalId: 9, EmpresaId: 7, ServicoId: 3,
        DataAgendamento: "2099-08-20T08:30:00",
        Valor: 50, Taxa: 0, ValorServico: 50, Status: "CONCLUIDO",
        ClienteNome: "Vitor Cliente", ServicoNome: "Corte",
        ProfissionalNome: "Profissional Teste",
      },
    ]);
    render(<MemoryRouter initialEntries={["/cliente-final/home"]}><ClienteFinalHome /></MemoryRouter>);
    expect(await screen.findByText("Nenhum atendimento agendado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Histórico" }));
    expect(screen.getByRole("heading", { name: "Anteriores" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Próximos" })).not.toBeInTheDocument();
  });

  it("permite ao cliente concluir um agendamento ativo", async () => {
    mocks.atualizarStatusAgendamento.mockResolvedValue({
      Id: 12,
      ClienteId: 4,
      ProfissionalId: 9,
      EmpresaId: 7,
      ServicoId: 2,
      DataAgendamento: "2099-08-20T08:30:00",
      Valor: 50,
      Taxa: 0,
      ValorServico: 50,
      Status: "CONCLUIDO",
      ClienteNome: "Vitor Cliente",
      ServicoNome: "Corte",
      ProfissionalNome: "Profissional Teste",
    });

    render(
      <MemoryRouter initialEntries={["/cliente-final/home"]}>
        <ClienteFinalHome />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Corte")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Concluir agendamento de Corte" }));

    await waitFor(() => {
      expect(mocks.atualizarStatusAgendamento).toHaveBeenCalledWith(12, "CONCLUIDO");
    });
    expect(await screen.findByText("Agendamento concluído.")).toBeInTheDocument();
  });
});
