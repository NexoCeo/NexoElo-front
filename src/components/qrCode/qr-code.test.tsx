import { fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "@/test/render-with-notifications";
import { beforeEach, describe, expect, it, vi } from "vitest";

const agendaMock = vi.hoisted(() => ({
  obterAgenda: vi.fn(),
  obterSlug: vi.fn(),
  getUrl: vi.fn(),
}));

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    theme: { colors: { text: "#ffffff", inactive: "#aaaaaa" } },
  }),
}));

vi.mock("@/context/UserContext", () => ({
  useUser: () => ({
    usuario: { Id: 7, Papel: "EMPRESA", Slug: "empresa-teste" },
  }),
}));

vi.mock("@/services/agenda-publica-service", () => ({
  obterAgendaPublica: agendaMock.obterAgenda,
  obterSlugUsuario: agendaMock.obterSlug,
  getClienteFinalAgendamentoUrl: agendaMock.getUrl,
}));

import QrCode from "./index";

describe("QrCode", () => {
  beforeEach(() => {
    agendaMock.obterAgenda.mockReset();
    agendaMock.obterAgenda.mockResolvedValue({ Slug: "empresa-teste" });
    agendaMock.obterSlug.mockReset();
    agendaMock.getUrl.mockReset();
    agendaMock.getUrl.mockReturnValue("https://agenda.teste/empresa-teste");
  });

  it("oculta a URL e copia o link da agenda publica pelo botao", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<QrCode />);

    const copyButton = await screen.findByRole("button", {
      name: "Copiar link da agenda publica",
    });
    expect(screen.queryByText("https://agenda.teste/empresa-teste")).not.toBeInTheDocument();

    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("https://agenda.teste/empresa-teste");
    });
    expect(screen.getByRole("button", { name: "Link copiado" })).toBeInTheDocument();
    expect(screen.getByText("O link da agenda publica esta pronto para compartilhar.")).toBeInTheDocument();
  });
});
