import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { render } from "@/test/render-with-notifications";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "@/context/LanguageContext";
import { beforeEach, describe, expect, it, vi } from "vitest";

const vinculoMock = vi.hoisted(() => ({
  listar: vi.fn(),
  historico: vi.fn(),
  responder: vi.fn(),
}));
const profissionalMock = vi.hoisted(() => ({
  listar: vi.fn(),
  criar: vi.fn(),
  atualizar: vi.fn(),
  original: vi.fn(),
}));

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    theme: { colors: { background: "#202020", background2: "#171717", text: "#fff", inactive: "#aaa", primary: "#4169e1" } },
  }),
}));

vi.mock("@/context/UserContext", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/context/UserContext")>(),
  useUser: () => ({ usuario: { Id: 7, Papel: "EMPRESA" } }),
}));

vi.mock("@/services/profissional-service", () => ({
  listarProfissionaisEmpresa: profissionalMock.listar,
  criarProfissionalEmpresa: profissionalMock.criar,
  atualizarProfissionalEmpresa: profissionalMock.atualizar,
  obterFotoOriginalProfissional: profissionalMock.original,
}));

vi.mock("@/hooks/useCadastroLocalizacao", () => ({
  CadastroLocalizacaoError: class CadastroLocalizacaoError extends Error {},
  useCadastroLocalizacao: () => ({
    payload: { latitude: -19.0183, longitude: -40.5367 },
    error: "",
    reset: vi.fn(),
    usarLocalizacaoAtual: vi.fn(),
  }),
}));

vi.mock("@/services/localizacao-service", () => ({
  resolverLocalizacao: vi.fn(),
}));

vi.mock("@/services/servico-service", () => ({
  listarServicosPorEmpresa: vi.fn().mockResolvedValue([]),
  listarServicosPorProfissional: vi.fn().mockResolvedValue([]),
  salvarServicosDoProfissional: vi.fn(),
}));

vi.mock("@/services/vinculo-service", () => ({
  listarSolicitacoesVinculo: vinculoMock.listar,
  listarHistoricoSolicitacoesVinculo: vinculoMock.historico,
  responderSolicitacaoVinculo: vinculoMock.responder,
}));

vi.mock("../servicos/service-image-crop", () => ({
  default: ({ onApply, onCancel }: { onApply: (file: File) => void; onCancel: () => void }) => (
    <div>
      <button type="button" onClick={() => onApply(new File(["imagem"], "profissional-recortada.webp", { type: "image/webp" }))}>
        Aplicar recorte
      </button>
      <button type="button" onClick={onCancel}>Cancelar recorte</button>
    </div>
  ),
}));

import Profissionais from "./index";

describe("Profissionais", () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, "languages", { configurable: true, value: ["pt-BR"] });
    URL.createObjectURL = vi.fn(() => "blob:foto-profissional");
    URL.revokeObjectURL = vi.fn();
    profissionalMock.listar.mockReset();
    profissionalMock.listar.mockResolvedValue([]);
    profissionalMock.criar.mockReset();
    profissionalMock.atualizar.mockReset();
    profissionalMock.original.mockReset();
    profissionalMock.original.mockResolvedValue(null);
    vinculoMock.listar.mockReset();
    vinculoMock.listar.mockResolvedValue([]);
    vinculoMock.historico.mockReset();
    vinculoMock.historico.mockResolvedValue([]);
    vinculoMock.responder.mockReset();
  });

  it("preenche o modal com nome capitalizado e e-mail minúsculo, mesmo quando o banco devolve maiúsculas", async () => {
    profissionalMock.listar.mockResolvedValue([{
      Id: 33,
      Nome: "FELIPE COSTA",
      Email: "FELIPETESTE@GMAIL.COM",
      Telefone: "",
      FotoPerfil: "uploads/felipe.webp",
      VinculoStatus: "APROVADO",
    }]);

    render(<MemoryRouter><LanguageProvider><Profissionais /></LanguageProvider></MemoryRouter>);

    expect(await screen.findByText("Felipe Costa")).toBeInTheDocument();
    expect(screen.getByText("felipeteste@gmail.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Opções de Felipe Costa" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar" }));

    const dialog = screen.getByRole("dialog", { name: "Editar profissional" });
    const nomeInput = within(dialog).getByPlaceholderText("Nome do profissional");
    const emailInput = within(dialog).getByPlaceholderText("email@exemplo.com");
    expect(nomeInput).toHaveValue("Felipe Costa");
    expect(emailInput).toHaveValue("felipeteste@gmail.com");

    fireEvent.change(nomeInput, { target: { value: "JOÃO DA SILVA" } });
    fireEvent.blur(nomeInput);
    fireEvent.change(emailInput, { target: { value: "JOAO@EXEMPLO.COM" } });
    fireEvent.blur(emailInput);

    expect(nomeInput).toHaveValue("João da Silva");
    expect(emailInput).toHaveValue("joao@exemplo.com");
  });

  it("prepara as credenciais no WhatsApp depois de criar o profissional", async () => {
    profissionalMock.criar.mockResolvedValue({
      profissional: {
        Id: 15,
        Nome: "Profissional Teste",
        Email: "profissional@example.com",
        Telefone: "27999999999",
        VinculoStatus: "APROVADO",
      },
      senhaTemporaria: "SenhaTemporaria9!",
    });

    const { container } = render(<MemoryRouter><LanguageProvider><Profissionais /></LanguageProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /novo profissional/i }));
    fireEvent.change(await screen.findByPlaceholderText("Nome do profissional"), {
      target: { value: "Profissional Teste" },
    });
    fireEvent.change(screen.getByPlaceholderText("email@exemplo.com"), {
      target: { value: "profissional@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("(11) 99999-9999"), {
      target: { value: "27999999999" },
    });
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: {
        files: [new File([new Uint8Array([1])], "foto.png", { type: "image/png" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar recorte" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar profissional" }));

    const whatsappLink = await screen.findByRole("link", { name: /enviar pelo whatsapp/i });
    const url = new URL(whatsappLink.getAttribute("href")!);
    expect(url.searchParams.get("phone")).toBe("5527999999999");
    expect(url.searchParams.get("text")).toContain("profissional@example.com");
    expect(url.searchParams.get("text")).toContain("SenhaTemporaria9!");
  });

  it("lista solicitacoes pendentes e aprova sem sair da pagina", async () => {
    vinculoMock.listar.mockResolvedValue([
      { VinculoId: 21, Id: 9, Nome: "Profissional Pendente", Email: "pro@example.com", Telefone: "" },
    ]);
    vinculoMock.responder.mockResolvedValue(undefined);

    render(<MemoryRouter><LanguageProvider><Profissionais /></LanguageProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /vínculo profissionais/i }));

    expect(await screen.findByText("Profissional Pendente")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aprovar vinculo de Profissional Pendente" }));

    await waitFor(() => {
      expect(vinculoMock.responder).toHaveBeenCalledWith(7, 21, "APROVADO");
    });
    expect(screen.queryByText("Profissional Pendente")).not.toBeInTheDocument();
    expect(await screen.findByText(/agora faz parte da empresa/i)).toBeInTheDocument();
  });

  it("abre Vínculo profissionais com abas e mantém modal de tamanho padronizado mesmo vazio", async () => {
    vinculoMock.listar.mockResolvedValue([]);
    render(<MemoryRouter><LanguageProvider><Profissionais /></LanguageProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Vínculo profissionais" }));

    const dialog = screen.getByRole("dialog", { name: "Vínculo profissionais" });
    expect(dialog.className).toContain("requestsModal");
    expect(within(dialog).getByRole("tab", { name: "Solicitações" }))
      .toHaveAttribute("aria-selected", "true");
    expect(within(dialog).getByRole("tab", { name: "Histórico de solicitações" }))
      .toHaveAttribute("aria-selected", "false");
    expect(await within(dialog).findByText("Nenhuma solicitação pendente.")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("tab", { name: "Histórico de solicitações" }));
    await waitFor(() => expect(vinculoMock.historico).toHaveBeenCalledWith(7));
    expect(within(dialog).getByRole("tab", { name: "Histórico de solicitações" }))
      .toHaveAttribute("aria-selected", "true");
    expect(await within(dialog).findByText("Nenhuma solicitação respondida até o momento.")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("tab", { name: "Solicitações" }));
    expect(within(dialog).getByRole("tab", { name: "Solicitações" }))
      .toHaveAttribute("aria-selected", "true");
    expect(vinculoMock.listar).toHaveBeenCalledTimes(1);
  });

  it("exibe no histórico as solicitações aprovadas e recusadas sem botões de decisão", async () => {
    vinculoMock.historico.mockResolvedValue([
      { VinculoId: 32, ProfissionalId: 8, Nome: "Maria Silva", Email: "maria@example.com", Status: "APROVADO", DataSolicitacao: "2026-11-12T15:30:00" },
      { VinculoId: 31, ProfissionalId: 9, Nome: "FELIPE COSTA", Email: "FELIPE@EXEMPLO.COM", Status: "RECUSADO", DataSolicitacao: "2026-11-11T12:30:00" },
    ]);
    render(<MemoryRouter><LanguageProvider><Profissionais /></LanguageProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Vínculo profissionais" }));

    const dialog = screen.getByRole("dialog", { name: "Vínculo profissionais" });
    fireEvent.click(within(dialog).getByRole("tab", { name: "Histórico de solicitações" }));

    expect(await within(dialog).findByText("Maria Silva")).toBeInTheDocument();
    expect(within(dialog).getByText("Felipe Costa")).toBeInTheDocument();
    expect(within(dialog).getByText("felipe@exemplo.com")).toBeInTheDocument();
    expect(within(dialog).getByText("Aprovada")).toBeInTheDocument();
    expect(within(dialog).getByText("Recusada")).toBeInTheDocument();
    expect(within(dialog).getAllByText(/Solicitado em/)).toHaveLength(2);
    expect(within(dialog).queryByRole("button", { name: /aprovar vinculo/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /recusar vinculo/i })).not.toBeInTheDocument();
  });

  it("mostra erro de histórico sem perder as solicitações pendentes", async () => {
    vinculoMock.historico.mockRejectedValue(new Error("servidor indisponível"));
    vinculoMock.listar.mockResolvedValue([{
      VinculoId: 28, Id: 19, Nome: "Profissional Pendente", Email: "p@example.com", Status: "PENDENTE",
    }]);
    render(<MemoryRouter><LanguageProvider><Profissionais /></LanguageProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Vínculo profissionais" }));
    const dialog = screen.getByRole("dialog", { name: "Vínculo profissionais" });
    expect(await within(dialog).findByText("Profissional Pendente")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("tab", { name: "Histórico de solicitações" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Não foi possível carregar o histórico de solicitações.");
    fireEvent.click(within(dialog).getByRole("tab", { name: "Solicitações" }));
    expect(within(dialog).getByText("Profissional Pendente")).toBeInTheDocument();
  });

  it("nao exibe pais, estado ou cidade ao abrir o cadastro do profissional", async () => {
    render(<MemoryRouter><LanguageProvider><Profissionais /></LanguageProvider></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: /novo profissional/i }));

    expect(await screen.findByRole("heading", { name: "Novo profissional" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Pais")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Estado")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Cidade")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
  });

  it("exibe a causa enviada pelo backend quando o email pertence a outro usuario", async () => {
    profissionalMock.criar.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          code: "EMAIL_EM_USO",
          message: "O email informado ja pertence a outro usuario.",
        },
      },
    });
    const { container } = render(<MemoryRouter><LanguageProvider><Profissionais /></LanguageProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /novo profissional/i }));
    fireEvent.change(await screen.findByPlaceholderText("Nome do profissional"), {
      target: { value: "Profissional Teste" },
    });
    fireEvent.change(screen.getByPlaceholderText("email@exemplo.com"), {
      target: { value: "profissional@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("(11) 99999-9999"), {
      target: { value: "27999999999" },
    });
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: {
        files: [new File([new Uint8Array([1])], "foto.png", { type: "image/png" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar recorte" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar profissional" }));

    expect(
      await screen.findAllByText("O email informado ja pertence a outro usuario."),
    ).not.toHaveLength(0);
    expect(profissionalMock.criar).toHaveBeenCalledTimes(1);
  });
  it("reabre o recorte usando a foto original, mesmo após aplicar o primeiro recorte", async () => {
    profissionalMock.listar.mockResolvedValue([{
      Id: 21, Nome: "Profissional Recorte", Email: "recorte@example.com",
      Telefone: "", FotoPerfil: "uploads/foto-antiga.webp", VinculoStatus: "APROVADO",
    }]);
    render(<MemoryRouter><LanguageProvider><Profissionais /></LanguageProvider></MemoryRouter>);
    await screen.findByText("Profissional Recorte");
    fireEvent.click(screen.getByRole("button", { name: "Opções de Profissional Recorte" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar" }));
    const dialog = screen.getByRole("dialog", { name: "Editar profissional" });
    const original = new File(["original-sem-corte"], "foto-original.jpg", { type: "image/jpeg" });
    fireEvent.change(within(dialog).getByLabelText("Foto do profissional"), {
      target: { files: [original] },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar recorte" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Ajustar recorte" }));
    expect(vi.mocked(URL.createObjectURL)).toHaveBeenLastCalledWith(original);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar recorte" }));
  });

  it("reutiliza o modal de serviços para recortar e trocar a foto ao editar", async () => {
    profissionalMock.listar.mockResolvedValue([{
      Id: 11, Nome: "Profissional Teste", Email: "profissional@example.com",
      Telefone: "27999999999", FotoPerfil: "uploads/profissional.png", VinculoStatus: "APROVADO",
    }]);
    profissionalMock.atualizar.mockResolvedValue({
      Id: 11, Nome: "Profissional Teste", Email: "profissional@example.com",
      Telefone: "27999999999", FotoPerfil: "uploads/recortada.webp",
      VinculoStatus: "APROVADO",
    });
    render(<MemoryRouter><LanguageProvider><Profissionais /></LanguageProvider></MemoryRouter>);
    await screen.findByText("Profissional Teste");
    fireEvent.click(screen.getByRole("button", { name: "Opções de Profissional Teste" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar" }));

    const dialog = screen.getByRole("dialog", { name: "Editar profissional" });
    expect(within(dialog).getByAltText("Foto do profissional")).toHaveAttribute("src", expect.stringContaining("profissional.png"));
    expect(within(dialog).getByRole("button", { name: "Ajustar recorte" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Ajustar recorte" }));
    const aplicarRecorte = await within(dialog).findByRole("button", { name: "Aplicar recorte" });
    expect(within(dialog).getByRole("button", { name: "Salvar alterações" })).toBeDisabled();
    fireEvent.click(aplicarRecorte);
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(profissionalMock.atualizar).toHaveBeenCalledWith(11, {
        Nome: "Profissional Teste", Email: "profissional@example.com", Telefone: "27999999999",
        FotoPerfil: expect.objectContaining({ name: "profissional-recortada.webp", type: "image/webp" }),
        FotoOriginal: null,
      });
    });
  });

  it("permite salvar somente o novo recorte mesmo quando o telefone anterior está vazio", async () => {
    profissionalMock.listar.mockResolvedValue([{
      Id: 12, Nome: "Jacinto Abreu", Email: "jacinto@example.com",
      Telefone: "", FotoPerfil: "uploads/jacinto.png", VinculoStatus: "APROVADO",
    }]);
    profissionalMock.atualizar.mockResolvedValue({
      Id: 12, Nome: "Jacinto Abreu", Email: "jacinto@example.com",
      Telefone: "", FotoPerfil: "uploads/jacinto-recortada.webp", VinculoStatus: "APROVADO",
    });

    render(<MemoryRouter><LanguageProvider><Profissionais /></LanguageProvider></MemoryRouter>);
    await screen.findByText("Jacinto Abreu");
    fireEvent.click(screen.getByRole("button", { name: "Opções de Jacinto Abreu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar" }));
    const dialog = screen.getByRole("dialog", { name: "Editar profissional" });
    expect(within(dialog).getByPlaceholderText("(11) 99999-9999")).toHaveValue("");
    fireEvent.click(within(dialog).getByRole("button", { name: "Ajustar recorte" }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "Aplicar recorte" }));
    const submit = within(dialog).getByRole("button", { name: "Salvar alterações" });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => {
      expect(profissionalMock.atualizar).toHaveBeenCalledWith(12, {
        Nome: "Jacinto Abreu", Email: "jacinto@example.com", Telefone: "",
        FotoPerfil: expect.objectContaining({ name: "profissional-recortada.webp" }),
        FotoOriginal: null,
      });
    });
  });

  it("permite salvar somente o nome sem exigir uma nova foto nem telefone", async () => {
    profissionalMock.listar.mockResolvedValue([{
      Id: 13, Nome: "Nome Original", Email: "teste@example.com",
      Telefone: "", FotoPerfil: "uploads/original.png", VinculoStatus: "APROVADO",
    }]);
    profissionalMock.atualizar.mockResolvedValue({
      Id: 13, Nome: "Nome Atualizado", Email: "teste@example.com",
      Telefone: "", FotoPerfil: "uploads/original.png", VinculoStatus: "APROVADO",
    });
    render(<MemoryRouter><LanguageProvider><Profissionais /></LanguageProvider></MemoryRouter>);
    await screen.findByText("Nome Original");
    fireEvent.click(screen.getByRole("button", { name: "Opções de Nome Original" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar" }));
    const dialog = screen.getByRole("dialog", { name: "Editar profissional" });
    fireEvent.change(within(dialog).getByPlaceholderText("Nome do profissional"), {
      target: { value: "Nome Atualizado" },
    });
    const submit = within(dialog).getByRole("button", { name: "Salvar alterações" });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => {
      expect(profissionalMock.atualizar).toHaveBeenCalledWith(13, {
        Nome: "Nome Atualizado", Email: "teste@example.com",
        Telefone: "", FotoPerfil: null, FotoOriginal: null,
      });
    });
  });


  it("reabre foto persistida a partir do original, nao do WebP recortado", async () => {
    const original = new File(["foto inteira"], "profissional-original.jpg", { type: "image/jpeg" });
    profissionalMock.listar.mockResolvedValue([{
      Id: 18, Nome: "Profissional Original", Email: "original@example.com",
      Telefone: "", FotoPerfil: "uploads/recortada.webp", VinculoStatus: "APROVADO",
    }]);
    profissionalMock.original.mockResolvedValue(original);
    profissionalMock.atualizar.mockResolvedValue({
      Id: 18, Nome: "Profissional Original", Email: "original@example.com",
      Telefone: "", FotoPerfil: "uploads/nova-foto.webp", VinculoStatus: "APROVADO",
    });

    render(<MemoryRouter><LanguageProvider><Profissionais /></LanguageProvider></MemoryRouter>);
    await screen.findByText("Profissional Original");
    fireEvent.click(screen.getByRole("button", { name: "Opções de Profissional Original" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar" }));
    const dialog = screen.getByRole("dialog", { name: "Editar profissional" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Ajustar recorte" }));
    const aplicar = await within(dialog).findByRole("button", { name: "Aplicar recorte" });
    expect(profissionalMock.original).toHaveBeenCalledWith(18);
    expect(vi.mocked(URL.createObjectURL)).toHaveBeenLastCalledWith(original);
    fireEvent.click(aplicar);
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(profissionalMock.atualizar).toHaveBeenCalledWith(18,
      expect.objectContaining({ FotoOriginal: original })));
  });
});
