import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("./api", () => ({ default: apiMock }));

import { registerClienteFinal } from "./cliente-final-auth-service";
import { criarProfissionalEmpresa } from "./profissional-service";

function photo() {
  return new File([new Uint8Array([1])], "foto.png", { type: "image/png" });
}

describe("servicos de cadastro com localizacao compartilhada", () => {
  beforeEach(() => {
    apiMock.post.mockReset();
    apiMock.post.mockResolvedValue({ data: {} });
  });

  it("envia coordenadas no cadastro do cliente-final", async () => {
    await registerClienteFinal({
      nome: "Cliente Teste",
      email: "cliente@example.com",
      telefone: "27999999999",
      senha: "senha-segura",
      fotoPerfil: photo(),
      localizacao: { latitude: -19.0183, longitude: -40.5367 },
    });

    const form = apiMock.post.mock.calls[0][1] as FormData;
    expect(form.get("Latitude")).toBe("-19.0183");
    expect(form.get("Longitude")).toBe("-40.5367");
    expect(form.has("CidadeFk")).toBe(false);
  });

  it("envia somente coordenadas no cadastro do profissional pela empresa", async () => {
    await criarProfissionalEmpresa({
      empresaId: 7,
      nome: "Profissional Teste",
      email: "profissional@example.com",
      telefone: "27999999999",
      fotoPerfil: photo(),
      localizacao: { latitude: -19.0183, longitude: -40.5367 },
    });

    const form = apiMock.post.mock.calls[0][1] as FormData;
    expect(form.get("Latitude")).toBe("-19.0183");
    expect(form.get("Longitude")).toBe("-40.5367");
    expect(form.has("PaisId")).toBe(false);
    expect(form.has("EstadoId")).toBe(false);
    expect(form.has("CidadeFk")).toBe(false);
    expect(form.has("Senha")).toBe(false);
    expect(form.get("EmpresaId")).toBe("7");
    expect(form.has("EmpresaFk")).toBe(false);
    expect(form.has("UsuarioEmpresaId")).toBe(false);
    expect(apiMock.post).toHaveBeenCalledTimes(1);
  });
});
