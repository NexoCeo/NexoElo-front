import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { render } from "@/test/render-with-notifications";
import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  atualizarServico: vi.fn(),
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
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:service-test") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
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
    expect(screen.getByRole("columnheader", { name: "Servico" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Duracao" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Novo servico" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Novo servico" }));

    const dialog = screen.getByRole("dialog", { name: "Novo servico" });
    expect(within(dialog).getByLabelText("Nome do servico")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Fechar modal" }));
    expect(screen.queryByRole("dialog", { name: "Novo servico" })).not.toBeInTheDocument();
  });

  it("cadastra um novo servico pelo modal", async () => {
    render(<LanguageProvider><Servicos /></LanguageProvider>);
    await screen.findByText("Servico Teste");
    fireEvent.click(screen.getByRole("button", { name: "Novo servico" }));

    const dialog = screen.getByRole("dialog", { name: "Novo servico" });
    fireEvent.change(within(dialog).getByLabelText("Nome do servico"), {
      target: { value: "Corte masculino" },
    });
    fireEvent.change(within(dialog).getByLabelText("Valor"), {
      target: { value: "45,00" },
    });
    fireEvent.change(within(dialog).getByLabelText("Tempo estimado"), {
      target: { value: "45" },
    });
    const imagem = new File(["imagem"], "corte.png", { type: "image/png" });
    fireEvent.change(within(dialog).getByLabelText("Imagem do servico"), {
      target: { files: [imagem] },
    });
    expect(within(dialog).getByRole("button", { name: "Criar servico" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar recorte" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Criar servico" }));

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
    expect(await screen.findByText("Servico cadastrado com sucesso.")).toBeInTheDocument();
    expect(screen.getByText("O novo servico foi adicionado a sua lista.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Novo servico" })).not.toBeInTheDocument();
  });

  it("permite ajustar recorte da imagem ja cadastrada no modal de edicao", async () => {
    serviceMocks.listarServicosPorEmpresa.mockResolvedValue([{
      Id: 2, NomeServico: "Servico Teste", Valor: 150,
      TempoEstimadoMinutos: 60, ImagemServico: "uploads/imagem.png",
    }]);
    render(<LanguageProvider><Servicos /></LanguageProvider>);
    await screen.findByText("Servico Teste");
    fireEvent.click(screen.getByRole("button", { name: "Opcoes de Servico Teste" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar" }));
    const dialog = screen.getByRole("dialog", { name: "Editar servico" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ajustar recorte da imagem atual" }));
    expect(within(dialog).getByRole("button", { name: "Salvar alteracoes" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar recorte" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alteracoes" }));
    await waitFor(() => expect(serviceMocks.atualizarServico).toHaveBeenCalledWith(2, {
      NomeServico: "Servico Teste", Valor: 150, TempoEstimadoMinutos: 60,
      ImagemServico: expect.objectContaining({ name: "servico-recortada.webp", type: "image/webp" }),
    }));
  });

  it("abre o menu do servico, edita e atualiza a linha sem recarregar", async () => {
    render(<LanguageProvider><Servicos /></LanguageProvider>);
    await screen.findByText("Servico Teste");

    fireEvent.click(screen.getByRole("button", { name: "Opcoes de Servico Teste" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar" }));

    const dialog = screen.getByRole("dialog", { name: "Editar servico" });
    expect(within(dialog).getByLabelText("Nome do servico")).toHaveValue("Servico Teste");
    fireEvent.change(within(dialog).getByLabelText("Nome do servico"), {
      target: { value: "Servico Atualizado" },
    });
    fireEvent.change(within(dialog).getByLabelText("Valor"), {
      target: { value: "180,00" },
    });
    fireEvent.change(within(dialog).getByLabelText("Tempo estimado"), {
      target: { value: "75" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alteracoes" }));

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
