import { fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "@/test/render-with-notifications";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FuncionamentoConfig } from "@/types/funcionamento";

const serviceMock = vi.hoisted(() => ({
  obterFuncionamento: vi.fn(),
  salvarFuncionamento: vi.fn(),
}));

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: "#212121",
        background2: "#181818",
        primary: "#4169e1",
        bottom: "#303030",
        text: "#ffffff",
        inactive: "#aaaaaa",
      },
    },
  }),
}));

vi.mock("@/context/UserContext", () => ({
  useUser: () => ({ usuario: { Id: 7, Nome: "Empresa Teste", Papel: "EMPRESA" } }),
}));

vi.mock("@/services/funcionamento-service", () => ({
  criarFuncionamentoPadrao: (usuarioId: number): FuncionamentoConfig => createConfig(usuarioId),
  obterFuncionamento: serviceMock.obterFuncionamento,
  salvarFuncionamento: serviceMock.salvarFuncionamento,
}));

import Funcionamento from "./index";

function createConfig(usuarioId = 7): FuncionamentoConfig {
  return {
    UsuarioFk: usuarioId,
    Domingo: false,
    Segunda: true,
    Terca: true,
    Quarta: true,
    Quinta: true,
    Sexta: true,
    Sabado: false,
    HorarioAbertura: "08:00",
    HorarioFechamento: "17:00",
    IntervaloInicio: null,
    IntervaloFim: null,
    Intervalos: [],
  };
}

describe("Funcionamento", () => {
  beforeEach(() => {
    serviceMock.obterFuncionamento.mockReset();
    serviceMock.salvarFuncionamento.mockReset();
    serviceMock.obterFuncionamento.mockResolvedValue(createConfig());
    serviceMock.salvarFuncionamento.mockImplementation(async (_usuarioId, config) => config);
  });

  it("separa dias, expediente e pausas em etapas independentes", async () => {
    render(<Funcionamento />);

    expect(await screen.findByRole("heading", { name: "Dias de atendimento" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Horario de funcionamento" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pausas e intervalos" })).toBeInTheDocument();
    expect(screen.getByLabelText("Segunda: selecionado")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Domingo: nao selecionado")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Sem pausas")).toBeInTheDocument();
    expect(screen.getByText("9h disponiveis por dia")).toBeInTheDocument();
  });

  it("adiciona almoco e uma segunda pausa livre e salva sem sair da tela", async () => {
    render(<Funcionamento />);
    await screen.findByRole("heading", { name: "Dias de atendimento" });

    fireEvent.click(screen.getByRole("button", { name: "Adicionar pausa" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar pausa" }));

    expect(screen.getByLabelText("Inicio da pausa 1")).toHaveValue("12:00");
    expect(screen.getByLabelText("Fim da pausa 1")).toHaveValue("13:00");
    expect(screen.getByLabelText("Inicio da pausa 2")).toHaveValue("15:00");
    expect(screen.getByLabelText("Fim da pausa 2")).toHaveValue("16:00");

    fireEvent.change(screen.getByLabelText("Fim da pausa 2"), { target: { value: "15:30" } });
    expect(screen.getByText("30 min")).toBeInTheDocument();
    expect(screen.getByText("15:00 - 15:30")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar funcionamento" }));

    await waitFor(() => {
      expect(serviceMock.salvarFuncionamento).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          HorarioAbertura: "08:00",
          HorarioFechamento: "17:00",
          Intervalos: [
            { Inicio: "12:00", Fim: "13:00" },
            { Inicio: "15:00", Fim: "15:30" },
          ],
        }),
      );
    });
    expect(screen.getByText("Funcionamento salvo com sucesso.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Funcionamento" })).toBeInTheDocument();
  });

  it("aplica a selecao rapida de dias uteis e bloqueia pausas fora do expediente", async () => {
    const config = createConfig();
    config.Domingo = true;
    serviceMock.obterFuncionamento.mockResolvedValue(config);
    render(<Funcionamento />);
    await screen.findByRole("heading", { name: "Dias de atendimento" });

    fireEvent.click(screen.getByRole("button", { name: "Seg a sex" }));
    expect(screen.getByLabelText("Domingo: nao selecionado")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("Sexta: selecionado")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Adicionar pausa" }));
    fireEvent.change(screen.getByLabelText("Inicio da pausa 1"), { target: { value: "07:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar funcionamento" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Todas as pausas devem ficar dentro do horario de funcionamento.",
    );
    expect(serviceMock.salvarFuncionamento).not.toHaveBeenCalled();
  });
});
