import { fireEvent, screen, within } from "@testing-library/react";
import { render } from "@/test/render-with-notifications";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import layoutStyles from "./style.module.css";
import sidebarStyles from "@/components/sidebar/style.module.css";

const toggleThemeMock = vi.hoisted(() => vi.fn());

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
    themeName: "dark",
    toggleTheme: toggleThemeMock,
  }),
}));

vi.mock("@/context/UserContext", () => ({
  useUser: () => ({
    usuario: {
      Id: 7,
      Nome: "Empresa Teste",
      Email: "empresa@teste.com",
      Papel: "EMPRESA",
      FotoPerfil: "",
    },
  }),
}));

vi.mock("@/components/qrCode", () => ({
  default: () => (
    <section data-testid="public-agenda-content">
      <span>QR Code da agenda publica</span>
      <a href="https://agenda.teste/empresa">Link de agendamento</a>
    </section>
  ),
}));

import SharedRoleLayout from "./index";

function renderLayout(path = "/empresa/agenda") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SharedRoleLayout>
        <main>Pagina autenticada</main>
      </SharedRoleLayout>
    </MemoryRouter>,
  );
}

describe("SharedRoleLayout", () => {
  beforeEach(() => {
    toggleThemeMock.mockReset();
  });

  it("abre a agenda publica pelo Me encontre e fecha o modal pelo X", () => {
    renderLayout();

    expect(screen.queryByRole("dialog", { name: "Me encontre" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Me encontre" }));

    const dialog = screen.getByRole("dialog", { name: "Me encontre" });
    expect(within(dialog).getByTestId("public-agenda-content")).toBeInTheDocument();
    expect(within(dialog).getByText("QR Code da agenda publica")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Link de agendamento" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Fechar Me encontre" }));

    expect(screen.queryByRole("dialog", { name: "Me encontre" })).not.toBeInTheDocument();
  });

  it("mantem o hamburguer no header, exibe o X na sidebar e desloca o conteudo ao abrir", () => {
    renderLayout();

    const header = screen.getByRole("banner");
    const navigation = screen.getByRole("navigation", { hidden: true });
    const content = screen.getByTestId("role-page-content");
    const openButton = within(header).getByRole("button", { name: "Abrir menu" });

    expect(navigation).toHaveAttribute("aria-hidden", "true");
    expect(content).not.toHaveClass(layoutStyles.contentShifted);

    fireEvent.click(openButton);

    expect(openButton).toHaveAttribute("aria-expanded", "true");
    expect(within(navigation).getByRole("button", { name: "Fechar menu" })).toBeInTheDocument();
    expect(navigation).toHaveAttribute("aria-hidden", "false");
    expect(content).toHaveClass(layoutStyles.contentShifted);

    fireEvent.click(within(navigation).getByRole("button", { name: "Fechar menu" }));

    expect(navigation).toHaveAttribute("aria-hidden", "true");
    expect(content).not.toHaveClass(layoutStyles.contentShifted);
  });

  it("destaca a rota atual e fecha o menu ao selecionar outra pagina", () => {
    renderLayout();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));

    const agendaLink = screen.getByRole("link", { name: "Agenda" });
    const servicesLink = screen.getByRole("link", { name: "Servicos" });
    expect(agendaLink).toHaveAttribute("aria-current", "page");
    expect(agendaLink).toHaveClass(sidebarStyles.active);

    fireEvent.click(servicesLink);

    expect(servicesLink).toHaveAttribute("aria-current", "page");
    expect(servicesLink).toHaveClass(sidebarStyles.active);
    expect(screen.getByRole("navigation", { hidden: true })).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("role-page-content")).not.toHaveClass(layoutStyles.contentShifted);
  });

  it("exibe relatorios na sidebar da empresa e destaca a rota", () => {
    renderLayout("/empresa/relatorios");
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));

    const reportsLink = screen.getByRole("link", { name: "Relatorios" });
    expect(reportsLink).toHaveAttribute("href", "/empresa/relatorios");
    expect(reportsLink).toHaveAttribute("aria-current", "page");
    expect(reportsLink).toHaveClass(sidebarStyles.active);
  });

  it("fecha a sidebar ao tocar fora dela", () => {
    renderLayout();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));

    fireEvent.pointerDown(screen.getByText("Pagina autenticada"));

    expect(screen.getByRole("navigation", { hidden: true })).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("role-page-content")).not.toHaveClass(layoutStyles.contentShifted);
  });

  it("fecha a sidebar pela tecla Escape", () => {
    renderLayout("/empresa/funcionamento");
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));

    expect(screen.getByRole("link", { name: "Funcionamento" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByRole("button", { name: "Abrir menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByTestId("role-page-content")).not.toHaveClass(layoutStyles.contentShifted);
  });

  it("mantem o controle de tema dentro do menu do perfil", () => {
    renderLayout("/empresa/dashboard");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu do perfil" }));

    const profileMenu = screen.getByRole("menu");
    expect(within(profileMenu).getByRole("menuitem", { name: "Meu perfil" })).toHaveAttribute(
      "href",
      "/empresa/perfil",
    );

    fireEvent.click(within(profileMenu).getByRole("menuitem", { name: "Usar tema claro" }));
    expect(toggleThemeMock).toHaveBeenCalledTimes(1);
  });
});
