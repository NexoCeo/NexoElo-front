import { fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "@/test/render-with-notifications";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  criarAgendamento: vi.fn(),
  listarHorariosDisponiveis: vi.fn(),
  listarProfissionaisAgendamento: vi.fn(),
  listarResponsaveisAgendamento: vi.fn(),
  listarServicosPorEmpresa: vi.fn(),
  listarServicosPorProfissional: vi.fn(),
}));

vi.mock("@/services/agendamento-service", () => ({
  criarAgendamento: mocks.criarAgendamento,
  listarHorariosDisponiveis: mocks.listarHorariosDisponiveis,
  listarProfissionaisAgendamento: mocks.listarProfissionaisAgendamento,
  listarResponsaveisAgendamento: mocks.listarResponsaveisAgendamento,
}));

vi.mock("@/services/agenda-publica-service", () => ({
  obterAgendaPublica: vi.fn(),
}));

vi.mock("@/services/cliente-final-auth-token", () => ({
  getClienteFinalUser: () => ({ Id: 4, Nome: "Cliente Teste" }),
}));

vi.mock("@/services/servico-service", () => ({
  listarServicosPorEmpresa: mocks.listarServicosPorEmpresa,
  listarServicosPorProfissional: mocks.listarServicosPorProfissional,
}));

import ClienteFinalAgendar from "./index";

describe("ClienteFinalAgendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listarResponsaveisAgendamento.mockResolvedValue([
      {
        Id: 7,
        Nome: "Autonomo Teste",
        Email: "",
        Telefone: "",
        TipoUsuario: "AUTONOMO",
        FotoPerfil: "uploads/autonomo.png",
      },
    ]);
    mocks.listarServicosPorEmpresa.mockResolvedValue([
      {
        Id: 2,
        NomeServico: "Corte",
        Valor: 50,
        TempoEstimadoMinutos: 30,
        ImagemServico: "uploads/corte.png",
      },
    ]);
    mocks.listarProfissionaisAgendamento.mockResolvedValue([]);
    mocks.listarServicosPorProfissional.mockResolvedValue([]);
    mocks.listarHorariosDisponiveis.mockResolvedValue([
      { DataAgendamento: "2099-08-20T08:00:00", Horario: "08:00" },
      { DataAgendamento: "2099-08-20T08:30:00", Horario: "08:30" },
    ]);
    mocks.criarAgendamento.mockResolvedValue({ Id: 42 });
  });

  it("permite agendar somente um horario retornado pelo backend e sem taxa no payload", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/cliente-final/agendar"]}>
        <ClienteFinalAgendar />
      </MemoryRouter>,
    );

    const autonomoOption = await screen.findByRole("button", { name: /Autonomo Teste/i });
    expect(screen.getByAltText("Foto de Autonomo Teste")).toHaveAttribute(
      "src",
      expect.stringContaining("/uploads/autonomo.png"),
    );
    fireEvent.click(autonomoOption);

    expect(screen.getByRole("button", { name: "Expandir Autonomo ou empresa" }))
      .toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("heading", { name: "Resumo" })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.listarServicosPorEmpresa).toHaveBeenCalledWith(7);
    });
    const serviceOption = await screen.findByRole("button", { name: /Corte/i });
    expect(await screen.findByAltText("Imagem do servico Corte")).toHaveAttribute(
      "src",
      expect.stringContaining("/uploads/corte.png"),
    );
    fireEvent.click(serviceOption);
    fireEvent.change(screen.getByLabelText("Data"), {
      target: { value: "2099-08-20" },
    });

    expect(await screen.findByRole("button", { name: "08:00" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "08:30" })).toBeInTheDocument();
    expect(container.querySelector('input[type="datetime-local"]')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "08:30" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));

    await waitFor(() => {
      expect(mocks.criarAgendamento).toHaveBeenCalledWith({
        ClienteId: 4,
        ResponsavelId: 7,
        ProfissionalId: undefined,
        ServicoId: 2,
        DataAgendamento: "2099-08-20T08:30:00",
      });
    });
    expect(await screen.findByText("Agendamento criado com sucesso.")).toBeInTheDocument();
  });

  it("exibe as fotos da empresa, do profissional e a imagem do servico", async () => {
    mocks.listarResponsaveisAgendamento.mockResolvedValue([
      {
        Id: 7,
        Nome: "Empresa Teste",
        Email: "",
        Telefone: "",
        TipoUsuario: "EMPRESA",
        FotoPerfil: "uploads/empresa.png",
      },
    ]);
    mocks.listarProfissionaisAgendamento.mockResolvedValue([
      {
        Id: 9,
        Nome: "Profissional Teste",
        VinculoStatus: "APROVADO",
        FotoPerfil: "uploads/profissional.png",
      },
    ]);
    mocks.listarServicosPorProfissional.mockResolvedValue([
      {
        Id: 3,
        NomeServico: "Coloracao",
        Valor: 120,
        TempoEstimadoMinutos: 90,
        ImagemServico: "uploads/coloracao.webp",
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/cliente-final/agendar"]}>
        <ClienteFinalAgendar />
      </MemoryRouter>,
    );

    expect(await screen.findByAltText("Foto de Empresa Teste")).toHaveAttribute(
      "src",
      expect.stringContaining("/uploads/empresa.png"),
    );
    fireEvent.click(await screen.findByRole("button", { name: /Empresa Teste/i }));

    expect(await screen.findByAltText("Foto de Profissional Teste")).toHaveAttribute(
      "src",
      expect.stringContaining("/uploads/profissional.png"),
    );
    fireEvent.click(await screen.findByRole("button", { name: /Profissional Teste/i }));

    expect(await screen.findByAltText("Imagem do servico Coloracao")).toHaveAttribute(
      "src",
      expect.stringContaining("/uploads/coloracao.webp"),
    );
    expect(screen.queryByText("Resumo")).not.toBeInTheDocument();
  });

  it("recolhe a etapa selecionada e permite expandir novamente pelas setas", async () => {
    render(
      <MemoryRouter initialEntries={["/cliente-final/agendar"]}>
        <ClienteFinalAgendar />
      </MemoryRouter>,
    );

    const autonomoOption = await screen.findByRole("button", { name: /Autonomo Teste/i });
    fireEvent.click(autonomoOption);

    const responsavelToggle = screen.getByRole("button", {
      name: "Expandir Autonomo ou empresa",
    });
    expect(responsavelToggle).toHaveAttribute("aria-expanded", "false");
    expect(await screen.findByRole("button", { name: /Corte/i })).toBeInTheDocument();

    fireEvent.click(responsavelToggle);

    expect(screen.getByRole("button", { name: "Recolher Autonomo ou empresa" }))
      .toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Autonomo Teste/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("button", { name: /Corte/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expandir Servico" }));
    expect(await screen.findByRole("button", { name: /Corte/i })).toBeInTheDocument();
  });
});
