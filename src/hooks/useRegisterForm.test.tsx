import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  roleLocation: "automatica",
  cityId: 1701,
  locationRequest: vi.fn(),
  listCompanies: vi.fn(),
  notify: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock("@/hooks/useCadastroLocalizacao", () => ({
  CadastroLocalizacaoError: class CadastroLocalizacaoError extends Error {},
  useCadastroLocalizacao: () => ({
    modo: mocks.roleLocation,
    cidadeId: mocks.cityId,
    loading: false,
    error: "",
    isValid: true,
    payload: { latitude: -19.0183, longitude: -40.5367 },
    usarLocalizacaoAtual: mocks.locationRequest,
  }),
}));

vi.mock("@/services/agenda-publica-service", () => ({
  listarEmpresasParaCadastro: mocks.listCompanies,
}));
vi.mock("@/context/NotificationContext", () => ({
  useNotification: () => ({ showNotification: mocks.notify }),
}));
vi.mock("@/context/UserContext", () => ({
  useUser: () => ({ setUsuario: mocks.setUser }),
}));

import { useRegisterForm } from "./useRegisterForm";

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("useRegisterForm pré-carregamento de empresas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.roleLocation = "automatica";
    mocks.cityId = 1701;
    mocks.locationRequest.mockResolvedValue({ latitude: -19, longitude: -40 });
    mocks.listCompanies.mockResolvedValue([
      { Id: 13, Nome: "Empresa A" },
      { Id: 14, Nome: "Empresa B" },
    ]);
  });

  it("busca empresas enquanto o papel ainda é Autônomo", async () => {
    const { result } = renderHook(() => useRegisterForm(), { wrapper });

    expect(result.current.TipoUsuario).toBe("autonomo");
    await waitFor(() => expect(result.current.empresas).toHaveLength(2));
    expect(mocks.listCompanies).toHaveBeenCalledOnce();
    expect(mocks.listCompanies).toHaveBeenCalledWith();

    act(() => result.current.setTipoUsuario("profissional"));
    expect(result.current.empresas).toHaveLength(2);
    expect(result.current.loadingEmpresas).toBe(false);
    expect(mocks.listCompanies).toHaveBeenCalledOnce();

    act(() => result.current.setEmpresaId(14));
    act(() => result.current.setTipoUsuario("empresa"));
    act(() => result.current.setTipoUsuario("profissional"));
    expect(result.current.empresaId).toBe(14);
    expect(mocks.listCompanies).toHaveBeenCalledOnce();
  });

  it("inicia o catálogo mesmo quando a localização não foi identificada", async () => {
    mocks.roleLocation = "nao-selecionada";
    mocks.cityId = 0;

    const { result } = renderHook(() => useRegisterForm(), { wrapper });
    expect(result.current.TipoUsuario).toBe("autonomo");
    await waitFor(() => expect(mocks.locationRequest).toHaveBeenCalledOnce());
    await waitFor(() => expect(result.current.empresas).toHaveLength(2));
    expect(mocks.listCompanies).toHaveBeenCalledOnce();
    expect(mocks.listCompanies).toHaveBeenCalledWith();

    act(() => result.current.setTipoUsuario("profissional"));
    expect(result.current.empresas).toHaveLength(2);
    expect(mocks.listCompanies).toHaveBeenCalledOnce();
  });

  it("mantém indicador de carregamento enquanto a requisição iniciada anteriormente resolve", async () => {
    let resolve!: (data: Array<{ Id: number; Nome: string }>) => void;
    mocks.listCompanies.mockReturnValue(new Promise(done => { resolve = done; }));

    const { result } = renderHook(() => useRegisterForm(), { wrapper });
    expect(result.current.loadingEmpresas).toBe(true);

    act(() => result.current.setTipoUsuario("profissional"));
    expect(mocks.listCompanies).toHaveBeenCalledOnce();

    await act(async () => resolve([{ Id: 15, Nome: "Empresa C" }]));
    await waitFor(() => expect(result.current.empresas).toEqual([{ Id: 15, Nome: "Empresa C" }]));
    expect(result.current.loadingEmpresas).toBe(false);
  });
});
