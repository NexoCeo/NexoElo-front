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

import Servicos from "./index";

describe("Servicos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    render(<Servicos />);

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
    render(<Servicos />);
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
    fireEvent.click(within(dialog).getByRole("button", { name: "Criar servico" }));

    await waitFor(() => {
      expect(serviceMocks.inserirServico).toHaveBeenCalledWith({
        UsuarioFk: 7,
        EmpresaId: 7,
        ProfissionalId: null,
        NomeServico: "Corte masculino",
        Valor: 45,
        TempoEstimadoMinutos: 45,
        ImagemServico: imagem,
      });
    });
    expect(await screen.findByText("Servico cadastrado com sucesso.")).toBeInTheDocument();
    expect(screen.getByText("O novo servico foi adicionado a sua lista.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Novo servico" })).not.toBeInTheDocument();
  });

  it("abre o menu do servico, edita e atualiza a linha sem recarregar", async () => {
    render(<Servicos />);
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
