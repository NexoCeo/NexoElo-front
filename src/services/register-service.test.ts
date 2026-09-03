import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("./api", () => ({ default: apiMock }));

import { Register } from "./register-service";

describe("Register", () => {
  beforeEach(() => apiMock.post.mockReset());

  it("envia a empresa escolhida no pre-cadastro do profissional", async () => {
    apiMock.post.mockResolvedValue({ data: { Id: 9, VinculoStatus: "PENDENTE" } });
    const photo = new File([new Uint8Array([1, 2, 3])], "foto.png", { type: "image/png" });

    await Register(
      photo,
      "Profissional",
      "pro@example.com",
      "senha-segura",
      "PROFISSIONAL",
      { latitude: -19.0183, longitude: -40.5367 },
      undefined,
      undefined,
      7,
    );

    const form = apiMock.post.mock.calls[0][1] as FormData;
    expect(form.get("TipoUsuario")).toBe("PROFISSIONAL");
    expect(form.get("EmpresaId")).toBe("7");
    expect(form.get("Latitude")).toBe("-19.0183");
    expect(form.get("Longitude")).toBe("-40.5367");
    expect(form.has("PaisId")).toBe(false);
    expect(form.has("EstadoId")).toBe(false);
    expect(form.has("CidadeFk")).toBe(false);
  });

  it("envia somente coordenadas quando a localizacao e automatica", async () => {
    apiMock.post.mockResolvedValue({ data: { Id: 10 } });

    await Register(
      null,
      "Empresa",
      "empresa@example.com",
      "senha-segura",
      "EMPRESA",
      { latitude: -19.0183, longitude: -40.5367 },
    );

    const form = apiMock.post.mock.calls[0][1] as FormData;
    expect(form.get("Latitude")).toBe("-19.0183");
    expect(form.get("Longitude")).toBe("-40.5367");
    expect(form.has("PaisId")).toBe(false);
    expect(form.has("EstadoId")).toBe(false);
    expect(form.has("CidadeFk")).toBe(false);
  });
});
