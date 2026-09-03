import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: "#202020",
        bottom: "#171717",
        text: "#fff",
        inactive: "#aaa",
        primary: "#4169e1",
      },
    },
  }),
}));

vi.mock("@/hooks/useRegisterForm", () => ({
  useRegisterForm: () => ({
    fotoPerfil: null,
    nome: "",
    email: "",
    senha: "",
    TipoUsuario: "",
    nomeFantasia: "",
    cnpj: "",
    localizacao: { cidadeId: 0 },
    empresas: [],
    empresaId: 0,
    loadingEmpresas: false,
    showPassword: false,
    error: "",
    emailError: "",
    loading: false,
    setFotoPerfil: vi.fn(),
    setNome: vi.fn(),
    setEmail: vi.fn(),
    setSenha: vi.fn(),
    setTipoUsuario: vi.fn(),
    setNomeFantasia: vi.fn(),
    setCnpj: vi.fn(),
    setEmpresaId: vi.fn(),
    setShowPassword: vi.fn(),
    isFormValid: () => false,
    handleSubmit: vi.fn(),
  }),
}));

vi.mock("@/hooks/useClienteFinalRegisterForm", () => ({
  useClienteFinalRegisterForm: () => ({
    nome: "",
    email: "",
    telefone: "",
    senha: "",
    confirmarSenha: "",
    fotoPerfil: null,
    showPassword: false,
    error: "",
    loading: false,
    redirectTo: "",
    setNome: vi.fn(),
    setEmail: vi.fn(),
    setTelefone: vi.fn(),
    setSenha: vi.fn(),
    setConfirmarSenha: vi.fn(),
    setFotoPerfil: vi.fn(),
    setShowPassword: vi.fn(),
    isFormValid: () => false,
    handleSubmit: vi.fn(),
  }),
}));

import Register from "@/pages/auth/signup";
import ClienteFinalRegister from "@/pages/cliente-final/auth/register";

function expectNoManualLocationFields() {
  expect(screen.queryByText(/^Pais$/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/^Estado$/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/^Cidade$/i)).not.toBeInTheDocument();
}

describe("campos de localizacao dos cadastros publicos", () => {
  afterEach(cleanup);

  it("nao exibe pais, estado ou cidade no cadastro global", () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    expectNoManualLocationFields();
  });

  it("nao exibe pais, estado ou cidade no cadastro do cliente final", () => {
    render(
      <MemoryRouter>
        <ClienteFinalRegister />
      </MemoryRouter>,
    );

    expectNoManualLocationFields();
  });
});
