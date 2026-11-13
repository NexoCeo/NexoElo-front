import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const localizacaoMock = vi.hoisted(() => ({ resolver: vi.fn() }));

vi.mock("@/services/localizacao-service", () => ({
  resolverLocalizacao: localizacaoMock.resolver,
}));

import { useCadastroLocalizacao } from "./useCadastroLocalizacao";

describe("useCadastroLocalizacao", () => {
  beforeEach(() => {
    localizacaoMock.resolver.mockReset();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: PositionCallback) =>
          success({
            coords: { latitude: -19.0183, longitude: -40.5367 },
          } as GeolocationPosition),
        ),
      },
    });
  });

  it("obtem coordenadas somente quando solicitado e resolve a cidade no backend", async () => {
    localizacaoMock.resolver.mockResolvedValue({
      PaisId: 1,
      PaisNome: "Brasil",
      EstadoId: 2,
      EstadoNome: "Espirito Santo",
      CidadeId: 3,
      CidadeNome: "Sao Gabriel da Palha",
    });
    const { result } = renderHook(() => useCadastroLocalizacao());

    expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();

    let payload = null;
    await act(async () => {
      payload = await result.current.usarLocalizacaoAtual();
    });

    expect(payload).toEqual({ latitude: -19.0183, longitude: -40.5367 });
    expect(localizacaoMock.resolver).toHaveBeenCalledWith({
      latitude: -19.0183,
      longitude: -40.5367,
    });
    expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      {
        enableHighAccuracy: false,
        timeout: 7000,
        maximumAge: 300000,
      },
    );
    await waitFor(() => expect(result.current.cidadeId).toBe(3));
  });

  it("nao cria fallback manual quando a permissao e negada", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((_success: PositionCallback, error: PositionErrorCallback) =>
          error({ code: 1 } as GeolocationPositionError),
        ),
      },
    });
    const { result } = renderHook(() => useCadastroLocalizacao());

    let failure: unknown;
    await act(async () => {
      try {
        await result.current.usarLocalizacaoAtual();
      } catch (error) {
        failure = error;
      }
    });

    expect(failure).toMatchObject({ message: "Permita o acesso à localização nas configurações do navegador para continuar." });
    expect(result.current.modo).toBe("erro");
    expect(result.current.payload).toBeNull();
    expect(localizacaoMock.resolver).not.toHaveBeenCalled();
  });

  it("mantém coordenadas válidas mesmo quando a cidade não pode ser resolvida", async () => {
    localizacaoMock.resolver.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 422,
        data: {
          code: "LOCALIZACAO_NAO_RESOLVIDA",
          message: "A cidade identificada nao existe no cadastro de regioes.",
        },
      },
    });
    const { result } = renderHook(() => useCadastroLocalizacao());

    let payload: unknown;
    await act(async () => {
      payload = await result.current.usarLocalizacaoAtual();
    });

    // A resolução da cidade é complementar; o cadastro ainda pode
    // aproveitar as coordenadas, mas não deve inventar empresas locais.
    expect(payload).toEqual({ latitude: -19.0183, longitude: -40.5367 });
    expect(result.current.modo).toBe("automatica");
    expect(result.current.cidadeId).toBe(0);
    expect(result.current.payload).toEqual(payload);
  });
  it("usa GPS apenas se a localização aproximada falhar", async () => {
    localizacaoMock.resolver.mockResolvedValue({ CidadeId: 3 });
    const position = {
      coords: { latitude: -19.0183, longitude: -40.5367 },
    } as GeolocationPosition;
    const getCurrentPosition = vi.fn((
      success: PositionCallback,
      failure: PositionErrorCallback,
      options: PositionOptions,
    ) => {
      if (options.enableHighAccuracy) success(position);
      else failure({ code: 3 } as GeolocationPositionError);
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    const { result } = renderHook(() => useCadastroLocalizacao());
    await act(async () => { await result.current.usarLocalizacaoAtual(); });

    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(getCurrentPosition).toHaveBeenLastCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
    expect(result.current.cidadeId).toBe(3);
  });

  it("reutiliza a mesma solicitação de localização para chamadas simultâneas", async () => {
    localizacaoMock.resolver.mockResolvedValue({ CidadeId: 3 });
    let finish!: PositionCallback;
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      finish = success;
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    const { result } = renderHook(() => useCadastroLocalizacao());
    let first!: ReturnType<typeof result.current.usarLocalizacaoAtual>;
    let second!: ReturnType<typeof result.current.usarLocalizacaoAtual>;
    act(() => {
      first = result.current.usarLocalizacaoAtual();
      second = result.current.usarLocalizacaoAtual();
    });

    expect(first).toBe(second);
    expect(getCurrentPosition).toHaveBeenCalledOnce();

    await act(async () => {
      finish({ coords: { latitude: -19.0183, longitude: -40.5367 } } as GeolocationPosition);
      await Promise.all([first, second]);
    });

    expect(localizacaoMock.resolver).toHaveBeenCalledOnce();
    expect(result.current.cidadeId).toBe(3);
  });

});
