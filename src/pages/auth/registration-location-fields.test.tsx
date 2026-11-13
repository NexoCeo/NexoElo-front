import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "@/context/LanguageContext";
const registerState = vi.hoisted(() => ({
  role: "empresa",
  companies: [] as Array<{ Id: number; Nome: string }>,
  companiesLoading: false,
}));

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
    TipoUsuario: registerState.role,
    nomeFantasia: "",
    localizacao: { cidadeId: 0, modo: "detectando", loading: true },
    empresas: registerState.companies,
    empresaId: 0,
    loadingEmpresas: registerState.companiesLoading,
    empresasError: "",
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
  afterEach(() => {
    cleanup();
    registerState.role = "empresa";
    registerState.companies = [];
    registerState.companiesLoading = false;
  });

  it("nao exibe pais, estado ou cidade no cadastro global", () => {
    render(
      <MemoryRouter>
        <LanguageProvider>
          <Register />
        </LanguageProvider>
      </MemoryRouter>,
    );

    expectNoManualLocationFields();
    expect(screen.getByPlaceholderText(/nome fantasia|business name/i)).toBeInTheDocument();
    expect(screen.queryByText("CNPJ")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Digite o CNPJ")).not.toBeInTheDocument();
  });

  it("não bloqueia a seleção de uma empresa pronta no cache quando o GPS ainda está detectando", () => {
    registerState.role = "profissional";
    registerState.companies = [{ Id: 42, Nome: "Empresa Pré-carregada" }];
    registerState.companiesLoading = false;

    render(
      <MemoryRouter>
        <LanguageProvider>
          <Register />
        </LanguageProvider>
      </MemoryRouter>,
    );

    const selects = screen.getAllByRole("combobox");
    const companySelect = selects[selects.length - 1];

    expect(companySelect).toBeEnabled();
    expect(companySelect).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("option", { name: "Empresa Pré-carregada" }))
      .toHaveValue("42");
  });

  it("nao exibe pais, estado ou cidade no cadastro do cliente final", () => {
    render(
      <MemoryRouter>
        <LanguageProvider>
          <ClienteFinalRegister />
        </LanguageProvider>
      </MemoryRouter>,
    );

    expectNoManualLocationFields();
  });
});
