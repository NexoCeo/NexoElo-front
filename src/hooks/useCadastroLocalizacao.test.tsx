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
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
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

    expect(failure).toMatchObject({ message: "A permissao de localizacao foi negada." });
    expect(result.current.modo).toBe("erro");
    expect(result.current.payload).toBeNull();
    expect(localizacaoMock.resolver).not.toHaveBeenCalled();
  });

  it("propaga a mensagem do backend quando a cidade nao esta cadastrada", async () => {
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

    let failure: unknown;
    await act(async () => {
      try {
        await result.current.usarLocalizacaoAtual();
      } catch (error) {
        failure = error;
      }
    });

    expect(failure).toMatchObject({
      message: "A cidade identificada nao existe no cadastro de regioes.",
    });
    expect(result.current.error).toBe(
      "A cidade identificada nao existe no cadastro de regioes.",
    );
    expect(result.current.modo).toBe("erro");
    expect(result.current.payload).toBeNull();
  });
});
