import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { render } from "@/test/render-with-notifications";
import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  gerarRelatorioPdf: vi.fn(),
  nomeArquivoRelatorio: vi.fn(
    (tipo: string, ano: number, mes: number) => `${tipo}-${ano}-${mes}.pdf`,
  ),
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
  useUser: () => ({ usuario: { Id: 7, Papel: "EMPRESA" } }),
}));

vi.mock("@/services/relatorio-service", () => serviceMocks);
vi.mock("@/components/pdf-preview", () => ({
  default: ({ title }: { title: string }) => <div aria-label={`PDF - ${title}`} />,
}));

import Relatorios from "./index";

describe("Relatorios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.gerarRelatorioPdf.mockResolvedValue(
      new Blob(["%PDF"], { type: "application/pdf" }),
    );
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:relatorio-download"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("lista os tres relatorios e abre o PDF no modal", async () => {
    render(<Relatorios />);

    expect(screen.getByRole("heading", { name: "Resumo financeiro" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Servicos mais realizados" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agenda mensal" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Mes de referencia"), {
      target: { value: "2026-08" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Visualizar" })[0]);

    const dialog = await screen.findByRole("dialog", { name: "Resumo financeiro" });
    await waitFor(() => {
      expect(within(dialog).getByLabelText("PDF - Resumo financeiro")).toBeInTheDocument();
    });
    expect(serviceMocks.gerarRelatorioPdf).toHaveBeenCalledWith(
      "resumo-financeiro",
      2026,
      8,
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Fechar pre-visualizacao" }));
    expect(screen.queryByRole("dialog", { name: "Resumo financeiro" })).not.toBeInTheDocument();
  });

  it("permite baixar diretamente pelo cartao", async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(<Relatorios />);
    fireEvent.change(screen.getByLabelText("Mes de referencia"), {
      target: { value: "2026-08" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Baixar Agenda mensal" }));

    await waitFor(() => {
      expect(serviceMocks.gerarRelatorioPdf).toHaveBeenCalledWith(
        "agenda-mensal",
        2026,
        8,
      );
    });
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("notifica quando o relatorio nao pode ser gerado", async () => {
    serviceMocks.gerarRelatorioPdf.mockRejectedValueOnce(new Error("indisponivel"));

    render(<Relatorios />);
    fireEvent.click(screen.getAllByRole("button", { name: "Visualizar" })[0]);

    expect(await screen.findByText("Relatorio nao gerado")).toBeInTheDocument();
    expect(screen.getAllByText("Nao foi possivel gerar o relatorio. Tente novamente.")).toHaveLength(2);
  });
});
