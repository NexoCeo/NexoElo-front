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
import { LanguageProvider } from "@/context/LanguageContext";

describe("ClienteFinalAgendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mocks.listarResponsaveisAgendamento.mockResolvedValue([
      { Id: 7, Nome: "Autonomo Teste", TipoUsuario: "AUTONOMO", FotoPerfil: "uploads/autonomo.png" },
    ]);
    mocks.listarServicosPorEmpresa.mockResolvedValue([
      { Id: 2, NomeServico: "Corte", Valor: 50, TempoEstimadoMinutos: 30, ImagemServico: "uploads/corte.png" },
    ]);
    mocks.listarProfissionaisAgendamento.mockResolvedValue([]);
    mocks.listarServicosPorProfissional.mockResolvedValue([]);
    mocks.listarHorariosDisponiveis.mockResolvedValue([
      { DataAgendamento: "2099-08-20T08:00:00", Horario: "08:00" },
      { DataAgendamento: "2099-08-20T08:30:00", Horario: "08:30" },
    ]);
    mocks.criarAgendamento.mockResolvedValue({ Id: 42 });
  });

  it("permite buscar prestadores, escolher servico, horario e confirmar sem alterar o payload", async () => {
    render(<MemoryRouter initialEntries={["/cliente-final/agendar"]}><LanguageProvider><ClienteFinalAgendar /></LanguageProvider></MemoryRouter>);
    expect(await screen.findByRole("button", { name: /Autonomo Teste/i })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar prestador" }), { target: { value: "outro" } });
    expect(screen.getByText("Nenhum prestador corresponde à sua busca.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar prestador" }), { target: { value: "Autonomo" } });
    fireEvent.click(screen.getByRole("button", { name: /Autonomo Teste/i }));
    expect(await screen.findByAltText("Imagem do servico Corte")).toHaveAttribute("src", expect.stringContaining("/uploads/corte.png"));
    fireEvent.click(screen.getByRole("button", { name: /Corte/i }));
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2099-08-20" } });
    fireEvent.click(await screen.findByRole("button", { name: "08:30" }));
    expect(screen.getByRole("heading", { name: "Revise seu agendamento" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));
    await waitFor(() => expect(mocks.criarAgendamento).toHaveBeenCalledWith({
      ClienteId: 4, ResponsavelId: 7, ProfissionalId: undefined,
      ServicoId: 2, DataAgendamento: "2099-08-20T08:30:00",
    }));
    expect(await screen.findByText("Agendamento criado com sucesso.")).toBeInTheDocument();
  });

  it("mostra profissionais de empresa e permite retornar ao catalogo", async () => {
    mocks.listarResponsaveisAgendamento.mockResolvedValue([
      { Id: 7, Nome: "Empresa Teste", TipoUsuario: "EMPRESA", FotoPerfil: "uploads/empresa.png" },
    ]);
    mocks.listarProfissionaisAgendamento.mockResolvedValue([
      { Id: 9, Nome: "Profissional Teste", VinculoStatus: "APROVADO", FotoPerfil: "uploads/profissional.png" },
    ]);
    mocks.listarServicosPorProfissional.mockResolvedValue([
      { Id: 3, NomeServico: "Coloracao", Valor: 120, TempoEstimadoMinutos: 90, ImagemServico: "uploads/coloracao.webp" },
    ]);
    render(<MemoryRouter initialEntries={["/cliente-final/agendar"]}><LanguageProvider><ClienteFinalAgendar /></LanguageProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Empresa Teste/i }));
    expect(await screen.findByAltText("Foto de Profissional Teste")).toHaveAttribute("src", expect.stringContaining("/uploads/profissional.png"));
    fireEvent.click(screen.getByRole("button", { name: /Profissional Teste/i }));
    expect(await screen.findByAltText("Imagem do servico Coloracao")).toHaveAttribute("src", expect.stringContaining("/uploads/coloracao.webp"));
    fireEvent.click(screen.getByRole("button", { name: "Trocar profissional" }));
    expect(await screen.findByRole("button", { name: /Profissional Teste/i })).toBeInTheDocument();
  });

  it("restaura prestador, servico, data e horario da sessao apos recarregar", async () => {
    sessionStorage.setItem("nexoelo-booking-draft:4:marketplace", JSON.stringify({
      responsavelId: 7, profissionalId: 0, servicoId: 2,
      dataSelecionada: "2099-08-20", dataAgendamento: "2099-08-20T08:30:00",
      expandedSection: "confirmacao",
    }));
    render(<MemoryRouter initialEntries={["/cliente-final/agendar"]}><LanguageProvider><ClienteFinalAgendar /></LanguageProvider></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Revise seu agendamento" })).toBeInTheDocument();
    await waitFor(() => expect(mocks.listarHorariosDisponiveis).toHaveBeenCalledWith({
      responsavelId: 7, profissionalId: undefined, servicoId: 2, data: "2099-08-20",
    }));
    expect(await screen.findByRole("button", { name: "Confirmar agendamento" })).toBeEnabled();
    expect(screen.getByText("Corte")).toBeInTheDocument();
  });

  it("volta aos horarios quando o slot salvo nao esta mais disponivel", async () => {
    sessionStorage.setItem("nexoelo-booking-draft:4:marketplace", JSON.stringify({
      responsavelId: 7, profissionalId: 0, servicoId: 2,
      dataSelecionada: "2099-08-20", dataAgendamento: "2099-08-20T09:00:00",
      expandedSection: "confirmacao",
    }));
    render(<MemoryRouter initialEntries={["/cliente-final/agendar"]}><LanguageProvider><ClienteFinalAgendar /></LanguageProvider></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Escolha a data e o horário" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar agendamento" })).not.toBeInTheDocument();
  });

  it("filtra autonomos e empresas sem chamadas extras de API", async () => {
    mocks.listarResponsaveisAgendamento.mockResolvedValue([
      { Id: 7, Nome: "Autonomo Teste", TipoUsuario: "AUTONOMO" },
      { Id: 8, Nome: "Empresa Teste", TipoUsuario: "EMPRESA" },
    ]);
    render(<MemoryRouter initialEntries={["/cliente-final/agendar"]}><LanguageProvider><ClienteFinalAgendar /></LanguageProvider></MemoryRouter>);
    expect(await screen.findByRole("button", { name: /Empresa Teste/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Autônomos" }));
    expect(screen.queryByRole("button", { name: /Empresa Teste/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Autonomo Teste/i })).toBeInTheDocument();
    expect(mocks.listarResponsaveisAgendamento).toHaveBeenCalledTimes(1);
  });
});
