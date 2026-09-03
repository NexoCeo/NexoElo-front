import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { render } from "@/test/render-with-notifications";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setUsuario: vi.fn(),
  obterPerfilUsuario: vi.fn(),
  atualizarPerfilUsuario: vi.fn(),
  usuario: {
    Id: 7,
    Nome: "Empresa Teste",
    Email: "empresa@mail.com",
    Telefone: "27999999999",
    FotoPerfil: "SEM_FOTO",
    Papel: "EMPRESA",
    Slug: "empresa-teste",
    UrlPublica: "",
  },
}));

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: "#081223",
        background2: "#111827",
        primary: "#2563eb",
        onPrimary: "#ffffff",
        text: "#f7f8fa",
        inactive: "#6b7280",
      },
    },
  }),
}));

vi.mock("@/context/UserContext", () => ({
  useUser: () => ({
    usuario: mocks.usuario,
    setUsuario: mocks.setUsuario,
  }),
}));

vi.mock("@/services/usuario-service", () => ({
  obterPerfilUsuario: mocks.obterPerfilUsuario,
  atualizarPerfilUsuario: mocks.atualizarPerfilUsuario,
}));

import Perfil from "./index";

describe("Perfil", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.obterPerfilUsuario.mockResolvedValue(mocks.usuario);
    mocks.atualizarPerfilUsuario.mockResolvedValue({
      ...mocks.usuario,
      Nome: "Empresa Renovada",
      Email: "renovada@mail.com",
    });
  });

  it("carrega e apresenta os dados do usuario", async () => {
    render(<Perfil />);

    expect(await screen.findByRole("heading", { name: "Empresa Teste" })).toBeInTheDocument();
    expect(mocks.obterPerfilUsuario).toHaveBeenCalledWith(7);
  });

  it("edita o perfil e atualiza o contexto imediatamente", async () => {
    render(<Perfil />);
    await screen.findByRole("heading", { name: "Empresa Teste" });
    fireEvent.click(screen.getByRole("button", { name: "Editar perfil" }));

    const dialog = screen.getByRole("dialog", { name: "Editar perfil" });
    fireEvent.change(within(dialog).getByLabelText("Nome"), {
      target: { value: "Empresa Renovada" },
    });
    fireEvent.change(within(dialog).getByLabelText("E-mail"), {
      target: { value: "renovada@mail.com" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alteracoes" }));

    await waitFor(() => {
      expect(mocks.atualizarPerfilUsuario).toHaveBeenCalledWith(7, {
        Nome: "Empresa Renovada",
        Email: "renovada@mail.com",
        Telefone: "27999999999",
        FotoPerfil: null,
      });
    });
    expect(mocks.setUsuario).toHaveBeenLastCalledWith(
      expect.objectContaining({ Nome: "Empresa Renovada", Email: "renovada@mail.com" }),
    );
    expect(await screen.findByText("Perfil atualizado com sucesso.")).toBeInTheDocument();
  });
});
