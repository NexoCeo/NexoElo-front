import { fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "@/test/render-with-notifications";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listarHistoricoAgendamentos: vi.fn(),
  atualizarStatusAgendamento: vi.fn(),
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

import ClienteFinalHome from "./index";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

describe("ClienteFinalHome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("troca o conteudo pelas abas sem sair da rota home", async () => {
    render(
      <MemoryRouter initialEntries={["/cliente-final/home"]}>
        <ClienteFinalHome />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Olá, VITOR CLIENTE" })).toBeInTheDocument();
    expect(await screen.findByText("Corte")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Histórico" }));
    expect(screen.getByRole("heading", { name: "Histórico" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Próximos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Anteriores" })).toBeInTheDocument();
    expect(screen.getByText("Barba")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/cliente-final/home");

    fireEvent.click(screen.getByRole("tab", { name: "Perfil" }));
    expect(screen.getByRole("heading", { name: "Perfil" })).toBeInTheDocument();
    expect(screen.getByText("vitor@example.com")).toBeInTheDocument();
    expect(screen.getByText("(28) 99333-7212")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/cliente-final/home");

    await waitFor(() => {
      expect(mocks.listarHistoricoAgendamentos).toHaveBeenCalledWith(4);
    });
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
    expect(await screen.findByText("Corte")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar agendamento de Corte" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Limite de prazo atingido, o agendamento não pode ser cancelado.",
    );
    expect(screen.getByText("Prazo de cancelamento encerrado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar agendamento de Corte" })).toBeInTheDocument();
    expect(mocks.atualizarStatusAgendamento).not.toHaveBeenCalled();
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
