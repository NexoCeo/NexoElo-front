import { fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "@/test/render-with-notifications";
import { beforeEach, describe, expect, it, vi } from "vitest";

const vinculoMock = vi.hoisted(() => ({
  listar: vi.fn(),
  responder: vi.fn(),
}));
const profissionalMock = vi.hoisted(() => ({
  listar: vi.fn(),
  criar: vi.fn(),
}));

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    theme: { colors: { background: "#202020", background2: "#171717", text: "#fff", inactive: "#aaa", primary: "#4169e1" } },
  }),
}));

vi.mock("@/context/UserContext", () => ({
  useUser: () => ({ usuario: { Id: 7, Papel: "EMPRESA" } }),
}));

vi.mock("@/services/profissional-service", () => ({
  listarProfissionaisEmpresa: profissionalMock.listar,
  criarProfissionalEmpresa: profissionalMock.criar,
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
  responderSolicitacaoVinculo: vinculoMock.responder,
}));

import Profissionais from "./index";

describe("Profissionais", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:foto-profissional");
    URL.revokeObjectURL = vi.fn();
    profissionalMock.listar.mockReset();
    profissionalMock.listar.mockResolvedValue([]);
    profissionalMock.criar.mockReset();
    vinculoMock.listar.mockReset();
    vinculoMock.responder.mockReset();
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

    const { container } = render(<Profissionais />);
    fireEvent.click(screen.getByRole("button", { name: /novo profissional/i }));
    fireEvent.change(screen.getByPlaceholderText("Nome do profissional"), {
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

    render(<Profissionais />);
    fireEvent.click(screen.getByRole("button", { name: /solicitacoes de vinculo/i }));

    expect(await screen.findByText("Profissional Pendente")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aprovar vinculo de Profissional Pendente" }));

    await waitFor(() => {
      expect(vinculoMock.responder).toHaveBeenCalledWith(7, 21, "APROVADO");
    });
    expect(screen.queryByText("Profissional Pendente")).not.toBeInTheDocument();
    expect(screen.getByText(/foi vinculado a empresa/i)).toBeInTheDocument();
  });

  it("nao exibe pais, estado ou cidade ao abrir o cadastro do profissional", async () => {
    render(<Profissionais />);

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
    const { container } = render(<Profissionais />);
    fireEvent.click(screen.getByRole("button", { name: /novo profissional/i }));
    fireEvent.change(screen.getByPlaceholderText("Nome do profissional"), {
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
    fireEvent.click(screen.getByRole("button", { name: "Criar profissional" }));

    expect(
      await screen.findAllByText("O email informado ja pertence a outro usuario."),
    ).not.toHaveLength(0);
    expect(profissionalMock.criar).toHaveBeenCalledTimes(1);
  });
});
