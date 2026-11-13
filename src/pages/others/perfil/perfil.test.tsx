import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { render } from "@/test/render-with-notifications";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "@/context/LanguageContext";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setUsuario: vi.fn(),
  obterPerfilUsuario: vi.fn(),
  atualizarPerfilUsuario: vi.fn(),
  obterFotoOriginalUsuario: vi.fn(),
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
  obterFotoOriginalUsuario: mocks.obterFotoOriginalUsuario,
}));

vi.mock("../servicos/service-image-crop", () => ({
  default: ({ onApply, onCancel }: { onApply: (file: File) => void; onCancel: () => void }) => (
    <div>
      <button type="button" onClick={() => onApply(new File(["recortada"], "perfil-recortada.webp", { type: "image/webp" }))}>Aplicar recorte</button>
      <button type="button" onClick={onCancel}>Cancelar recorte</button>
    </div>
  ),
}));

import Perfil from "./index";

describe("Perfil", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.usuario.Papel = "EMPRESA";
    mocks.usuario.FotoPerfil = "SEM_FOTO";
    mocks.obterFotoOriginalUsuario.mockResolvedValue(null);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:perfil-original") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    mocks.obterPerfilUsuario.mockResolvedValue(mocks.usuario);
    mocks.atualizarPerfilUsuario.mockResolvedValue({
      ...mocks.usuario,
      Nome: "Empresa Renovada",
      Email: "renovada@mail.com",
    });
  });

  it("carrega e apresenta os dados do usuario", async () => {
    render(<MemoryRouter><LanguageProvider><Perfil /></LanguageProvider></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Empresa Teste" })).toBeInTheDocument();
    expect(mocks.obterPerfilUsuario).toHaveBeenCalledWith(7);
  });

  it("edita o perfil e atualiza o contexto imediatamente", async () => {
    render(<MemoryRouter><LanguageProvider><Perfil /></LanguageProvider></MemoryRouter>);
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
        FotoOriginal: null,
      });
    });
    expect(mocks.setUsuario).toHaveBeenLastCalledWith(
      expect.objectContaining({ Nome: "Empresa Renovada", Email: "renovada@mail.com" }),
    );
    expect(await screen.findByText("Perfil atualizado com sucesso.")).toBeInTheDocument();
  });

  it.each(["EMPRESA", "AUTONOMO", "PROFISSIONAL"])(
    "usa o mesmo modal compartilhado de perfil para o papel %s",
    async (papel) => {
      mocks.usuario.Papel = papel;
      render(<MemoryRouter><LanguageProvider><Perfil /></LanguageProvider></MemoryRouter>);
      await screen.findByRole("heading", { name: "Empresa Teste" });
      fireEvent.click(screen.getByRole("button", { name: "Editar perfil" }));

      const dialog = screen.getByRole("dialog", { name: "Editar perfil" });
      expect(within(dialog).getByLabelText("Nome")).toBeInTheDocument();
      expect(within(dialog).getByLabelText("E-mail")).toBeInTheDocument();
      expect(within(dialog).getByLabelText("Telefone")).toBeInTheDocument();
      expect(within(dialog).getByLabelText("Foto de perfil")).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Salvar alterações" })).toBeInTheDocument();
    },
  );

  it.each(["EMPRESA", "AUTONOMO", "PROFISSIONAL"])(
    "permite editar foto pelo avatar e preserva o original para o papel %s",
    async (papel) => {
      mocks.usuario.Papel = papel;
      render(<MemoryRouter><LanguageProvider><Perfil /></LanguageProvider></MemoryRouter>);
      await screen.findByRole("heading", { name: "Empresa Teste" });

      const original = new File(["imagem original"], "original.jpg", { type: "image/jpeg" });
      fireEvent.change(screen.getByLabelText("Escolher nova foto"), { target: { files: [original] } });
      const dialog = screen.getByRole("dialog", { name: "Editar perfil" });
      expect(within(dialog).getByRole("button", { name: "Salvar alterações" })).toBeDisabled();
      fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar recorte" }));
      fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));

      await waitFor(() => expect(mocks.atualizarPerfilUsuario).toHaveBeenCalledWith(7, {
        Nome: "Empresa Teste",
        Email: "empresa@mail.com",
        Telefone: "27999999999",
        FotoPerfil: expect.objectContaining({ name: "perfil-recortada.webp", type: "image/webp" }),
        FotoOriginal: original,
      }));
    },
  );

  it("abre novamente a foto integral armazenada, nao o recorte do servidor", async () => {
    mocks.usuario.FotoPerfil = "uploads/foto-recortada.webp";
    const original = new File(["foto integral"], "foto-original.png", { type: "image/png" });
    mocks.obterFotoOriginalUsuario.mockResolvedValue(original);

    render(<MemoryRouter><LanguageProvider><Perfil /></LanguageProvider></MemoryRouter>);
    await screen.findByRole("heading", { name: "Empresa Teste" });
    fireEvent.click(screen.getByRole("button", { name: "Editar perfil" }));
    const dialog = screen.getByRole("dialog", { name: "Editar perfil" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ajustar recorte" }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "Aplicar recorte" }));
    expect(mocks.obterFotoOriginalUsuario).toHaveBeenCalledWith(7);
    expect(vi.mocked(URL.createObjectURL)).toHaveBeenLastCalledWith(original);
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(mocks.atualizarPerfilUsuario).toHaveBeenCalledWith(7,
      expect.objectContaining({ FotoOriginal: original })));
  });
});
