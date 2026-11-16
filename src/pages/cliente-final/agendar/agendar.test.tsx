import { fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "@/test/render-with-notifications";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  criarAgendamento: vi.fn(),
  obterAgendaPublica: vi.fn(),
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
  obterAgendaPublica: mocks.obterAgendaPublica,
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
    render(
      <MemoryRouter initialEntries={["/cliente-final/agendar"]}>
        <LanguageProvider>
          <Routes>
            <Route path="/cliente-final/agendar" element={<ClienteFinalAgendar />} />
            <Route path="/cliente-final/home" element={<div>Pagina inicial do cliente</div>} />
          </Routes>
        </LanguageProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("button", { name: /Autonomo Teste/i })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar prestador" }), { target: { value: "outro" } });
    expect(screen.getByText("Nenhum prestador corresponde à sua busca.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar prestador" }), { target: { value: "Autonomo" } });
    fireEvent.click(screen.getByRole("button", { name: /Autonomo Teste/i }));
    expect(await screen.findByAltText("Imagem do servico Corte")).toHaveAttribute("src", expect.stringContaining("/uploads/corte.png"));
    fireEvent.click(screen.getByRole("button", { name: /Corte/i }));
    fireEvent.click(screen.getByRole("button", { name: /Escolher horário/i }));
    expect(await screen.findByRole("heading", { name: "Escolha a data e o horário" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Data|Date/i), { target: { value: "2099-08-20" } });
    fireEvent.click(await screen.findByRole("button", { name: "08:30" }));
    expect(screen.getByRole("heading", { name: "Revise seu agendamento" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));
    await waitFor(() => expect(mocks.criarAgendamento).toHaveBeenCalledWith({
      ClienteId: 4, ResponsavelId: 7, ProfissionalId: undefined,
      ServicoId: 2, ServicoIds: [2], Atendimentos: undefined, DataAgendamento: "2099-08-20T08:30:00",
    }));
    expect(await screen.findByText("Pagina inicial do cliente")).toBeInTheDocument();
    expect(sessionStorage.getItem("nexoelo-booking-draft:4:marketplace")).toBeNull();
  });


  it("seleciona dois servicos, soma valores e duracao e envia uma unica reserva", async () => {
    mocks.listarServicosPorEmpresa.mockResolvedValue([
      { Id: 2, NomeServico: "Corte", Valor: 50, TempoEstimadoMinutos: 30 },
      { Id: 3, NomeServico: "Escova", Valor: 70, TempoEstimadoMinutos: 45 },
    ]);
    render(
      <MemoryRouter initialEntries={["/cliente-final/agendar"]}>
        <LanguageProvider>
          <Routes>
            <Route path="/cliente-final/agendar" element={<ClienteFinalAgendar />} />
            <Route path="/cliente-final/home" element={<div>Pagina inicial do cliente</div>} />
          </Routes>
        </LanguageProvider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Autonomo Teste/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Corte/i }));
    fireEvent.click(screen.getByRole("button", { name: /Escova/i }));
    expect(screen.getByText(/75 min/)).toBeInTheDocument();
    expect(screen.getByText(/R\\$\\s?120,00/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Escolher horário/i }));
    fireEvent.change(screen.getByLabelText(/Data|Date/i), { target: { value: "2099-08-20" } });
    await waitFor(() => expect(mocks.listarHorariosDisponiveis).toHaveBeenCalledWith({
      responsavelId: 7, profissionalId: undefined, servicoId: 2, servicoIds: [2, 3], data: "2099-08-20",
    }));
    fireEvent.click(await screen.findByRole("button", { name: "08:30" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));
    await waitFor(() => expect(mocks.criarAgendamento).toHaveBeenCalledWith({
      ClienteId: 4, ResponsavelId: 7, ProfissionalId: undefined,
      ServicoId: 2, ServicoIds: [2, 3], Atendimentos: undefined, DataAgendamento: "2099-08-20T08:30:00",
    }));
    expect(mocks.criarAgendamento).toHaveBeenCalledTimes(1);
  });


  it("permite adicionar servicos de profissionais diferentes na mesma reserva", async () => {
    mocks.listarResponsaveisAgendamento.mockResolvedValue([
      { Id: 7, Nome: "Empresa Teste", TipoUsuario: "EMPRESA" },
    ]);
    mocks.listarProfissionaisAgendamento.mockResolvedValue([
      { Id: 9, Nome: "Ana", VinculoStatus: "APROVADO" },
      { Id: 10, Nome: "Maria", VinculoStatus: "APROVADO" },
    ]);
    mocks.listarServicosPorProfissional.mockImplementation(async (id: number) => id === 9
      ? [{ Id: 2, NomeServico: "Corte", Valor: 50, TempoEstimadoMinutos: 30 }]
      : [{ Id: 3, NomeServico: "Escova", Valor: 70, TempoEstimadoMinutos: 45 }]);
    render(
      <MemoryRouter initialEntries={["/cliente-final/agendar"]}>
        <LanguageProvider>
          <Routes>
            <Route path="/cliente-final/agendar" element={<ClienteFinalAgendar />} />
            <Route path="/cliente-final/home" element={<div>Pagina inicial do cliente</div>} />
          </Routes>
        </LanguageProvider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Empresa Teste/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Ana/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Corte/i }));
    fireEvent.click(screen.getByRole("button", { name: /Adicionar serviços de outro profissional/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Maria/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Escova/i }));
    expect(screen.getByText(/75 min/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Escolher horário/i }));
    fireEvent.change(screen.getByLabelText(/Data|Date/i), { target: { value: "2099-08-20" } });
    await waitFor(() => expect(mocks.listarHorariosDisponiveis).toHaveBeenCalledWith({
      responsavelId: 7, profissionalId: 10, servicoId: 2, servicoIds: [2, 3],
      atendimentos: [{ ServicoId: 2, ProfissionalId: 9 }, { ServicoId: 3, ProfissionalId: 10 }],
      data: "2099-08-20",
    }));
    fireEvent.click(await screen.findByRole("button", { name: "08:30" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));
    await waitFor(() => expect(mocks.criarAgendamento).toHaveBeenCalledWith(expect.objectContaining({
      ResponsavelId: 7, ProfissionalId: 9, ServicoIds: [2, 3],
      Atendimentos: [{ ServicoId: 2, ProfissionalId: 9 }, { ServicoId: 3, ProfissionalId: 10 }],
    })));
    expect(mocks.criarAgendamento).toHaveBeenCalledTimes(1);
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
    fireEvent.click(screen.getByRole("button", { name: "Escolher outro profissional" }));
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
      responsavelId: 7, profissionalId: undefined, servicoId: 2, servicoIds: [2], data: "2099-08-20",
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

  it("volta do slug para a lista geral de prestadores em um unico clique", async () => {
    mocks.obterAgendaPublica.mockResolvedValue({
      UsuarioId: 7, Nome: "Autonomo Teste", TipoUsuario: "AUTONOMO",
      Slug: "autonomo-teste", FotoPerfil: "uploads/autonomo.png",
    });
    render(
      <MemoryRouter initialEntries={["/cliente-final/agendar/autonomo-teste"]}>
        <LanguageProvider>
          <Routes>
            <Route path="/cliente-final/agendar" element={<ClienteFinalAgendar />} />
            <Route path="/cliente-final/agendar/:username" element={<ClienteFinalAgendar />} />
          </Routes>
        </LanguageProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Serviços disponíveis" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByRole("heading", { name: "Explore os prestadores" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Buscar prestador" })).toBeInTheDocument();
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
