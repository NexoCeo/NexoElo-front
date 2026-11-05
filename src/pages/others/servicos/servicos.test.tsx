import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { render } from "@/test/render-with-notifications";
import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  atualizarServico: vi.fn(),
  consultarAssinatura: vi.fn(),
  inserirServico: vi.fn(),
  listarServicosPorEmpresa: vi.fn(),
}));

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: "#212121",
        background2: "#181818",
        primary: "#4169e1",
        text: "#ffffff",
        inactive: "#aaaaaa",
      },
    },
  }),
}));

vi.mock("@/context/UserContext", () => ({
  useUser: () => ({ usuario: { Id: 7, Papel: "EMPRESA" } }),
}));

vi.mock("@/services/servico-service", () => serviceMocks);
vi.mock("@/services/assinatura-service", () => ({ consultarAssinatura: serviceMocks.consultarAssinatura }));

vi.mock("./service-image-crop", () => ({
  default: ({ onApply, onCancel }: { onApply: (file: File) => void; onCancel: () => void }) => (
    <div>
      <button type="button" onClick={() => onApply(new File(["recortada"], "servico-recortada.webp", { type: "image/webp" }))}>Aplicar recorte</button>
      <button type="button" onClick={onCancel}>Cancelar recorte</button>
    </div>
  ),
}));


import Servicos from "./index";
import { LanguageProvider } from "@/context/LanguageContext";

describe("Servicos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "languages", { configurable: true, value: ["pt-BR"] });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:service-test") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    serviceMocks.consultarAssinatura.mockResolvedValue({ AcessoAtivo: true, Plano: "GRATIS" });
    serviceMocks.listarServicosPorEmpresa.mockResolvedValue([
      {
        Id: 2,
        NomeServico: "Servico Teste",
        Valor: 150,
        TempoEstimadoMinutos: 60,
      },
    ]);
    serviceMocks.inserirServico.mockResolvedValue({ Id: 3 });
    serviceMocks.atualizarServico.mockResolvedValue({
      Id: 2,
      NomeServico: "Servico Atualizado",
      Valor: 180,
      TempoEstimadoMinutos: 75,
    });
  });

  it("exibe os servicos em tabela e abre o cadastro em modal", async () => {
    render(<LanguageProvider><Servicos /></LanguageProvider>);

    expect(await screen.findByText("Servico Teste")).toBeInTheDocument();
    expect(screen.getByText("Serviço")).toBeInTheDocument();
    expect(screen.getByText("Duração")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Novo serviço" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Novo serviço" }));

    const dialog = await screen.findByRole("dialog", { name: "Novo serviço" });
    expect(within(dialog).getByLabelText("Nome do serviço")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Fechar modal" }));
    expect(screen.queryByRole("dialog", { name: "Novo serviço" })).not.toBeInTheDocument();
  });

  it("cadastra um novo servico pelo modal", async () => {
    render(<LanguageProvider><Servicos /></LanguageProvider>);
    await screen.findByText("Servico Teste");
    fireEvent.click(screen.getByRole("button", { name: "Novo serviço" }));

    const dialog = await screen.findByRole("dialog", { name: "Novo serviço" });
    fireEvent.change(within(dialog).getByLabelText("Nome do serviço"), {
      target: { value: "Corte masculino" },
    });
    fireEvent.change(within(dialog).getByLabelText("Valor"), {
      target: { value: "45,00" },
    });
    fireEvent.change(within(dialog).getByLabelText("Tempo estimado"), {
      target: { value: "45" },
    });
    const imagem = new File(["imagem"], "corte.png", { type: "image/png" });
    fireEvent.change(within(dialog).getByLabelText("Imagem do serviço"), {
      target: { files: [imagem] },
    });
    expect(within(dialog).getByRole("button", { name: "Criar serviço" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar recorte" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Criar serviço" }));

    await waitFor(() => {
      expect(serviceMocks.inserirServico).toHaveBeenCalledWith({
        UsuarioFk: 7,
        EmpresaId: 7,
        ProfissionalId: null,
        NomeServico: "Corte masculino",
        Valor: 45,
        TempoEstimadoMinutos: 45,
        ImagemServico: expect.objectContaining({ name: "servico-recortada.webp", type: "image/webp" }),
      });
    });
    expect(await screen.findByText("Serviço cadastrado")).toBeInTheDocument();
    expect(screen.getByText("O novo servico foi adicionado a sua lista.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Novo serviço" })).not.toBeInTheDocument();
  });

  it("permite ajustar recorte da imagem ja cadastrada no modal de edicao", async () => {
    serviceMocks.listarServicosPorEmpresa.mockResolvedValue([{
      Id: 2, NomeServico: "Servico Teste", Valor: 150,
      TempoEstimadoMinutos: 60, ImagemServico: "uploads/imagem.png",
    }]);
    render(<LanguageProvider><Servicos /></LanguageProvider>);
    await screen.findByText("Servico Teste");
    fireEvent.click(screen.getByRole("button", { name: "Opções de Servico Teste" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar" }));
    const dialog = screen.getByRole("dialog", { name: "Editar serviço" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ajustar recorte" }));
    expect(within(dialog).getByRole("button", { name: "Salvar alterações" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar recorte" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(serviceMocks.atualizarServico).toHaveBeenCalledWith(2, {
      NomeServico: "Servico Teste", Valor: 150, TempoEstimadoMinutos: 60,
      ImagemServico: expect.objectContaining({ name: "servico-recortada.webp", type: "image/webp" }),
    }));
  });

  it("abre o menu do servico, edita e atualiza a linha sem recarregar", async () => {
    render(<LanguageProvider><Servicos /></LanguageProvider>);
    await screen.findByText("Servico Teste");

    fireEvent.click(screen.getByRole("button", { name: "Opções de Servico Teste" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar" }));

    const dialog = screen.getByRole("dialog", { name: "Editar serviço" });
    expect(within(dialog).getByLabelText("Nome do serviço")).toHaveValue("Servico Teste");
    fireEvent.change(within(dialog).getByLabelText("Nome do serviço"), {
      target: { value: "Servico Atualizado" },
    });
    fireEvent.change(within(dialog).getByLabelText("Valor"), {
      target: { value: "180,00" },
    });
    fireEvent.change(within(dialog).getByLabelText("Tempo estimado"), {
      target: { value: "75" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(serviceMocks.atualizarServico).toHaveBeenCalledWith(2, {
        NomeServico: "Servico Atualizado",
        Valor: 180,
        TempoEstimadoMinutos: 75,
        ImagemServico: null,
      });
    });
    expect(await screen.findByText("Servico Atualizado")).toBeInTheDocument();
    expect(screen.queryByText("Servico Teste")).not.toBeInTheDocument();
  });
});
