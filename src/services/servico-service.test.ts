import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

vi.mock("./api", () => ({
  default: {
    get: mocks.get,
    post: mocks.post,
    put: mocks.put,
  },
}));

import {
  atualizarServico,
  inserirServico,
  listarServicosPorEmpresa,
} from "./servico-service";

describe("servico-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserva a imagem retornada ao listar servicos", async () => {
    mocks.get.mockResolvedValue({
      data: [{
        Id: 2,
        NomeServico: "Corte",
        Valor: 50,
        TempoEstimadoMinutos: 30,
        ImagemServico: "uploads/corte.png",
      }],
    });

    const result = await listarServicosPorEmpresa(7);

    expect(result[0].ImagemServico).toBe("uploads/corte.png");
  });

  it("envia a imagem opcional em multipart ao criar o servico", async () => {
    const imagem = new File(["imagem"], "corte.png", { type: "image/png" });
    mocks.post.mockResolvedValue({
      data: { Id: 2, NomeServico: "Corte", Valor: 50, TempoEstimadoMinutos: 30 },
    });

    await inserirServico({
      UsuarioFk: 7,
      EmpresaId: 7,
      ProfissionalId: null,
      NomeServico: "Corte",
      Valor: 50,
      TempoEstimadoMinutos: 30,
      ImagemServico: imagem,
    });

    const [, formData] = mocks.post.mock.calls[0];
    expect(mocks.post).toHaveBeenCalledWith(
      "/Servico/InserirServicoComImagem",
      expect.any(FormData),
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    expect(formData.get("NomeServico")).toBe("Corte");
    expect(formData.get("ImagemServico")).toBe(imagem);
  });

  it("envia os dados alterados e a nova imagem em multipart", async () => {
    const imagem = new File(["imagem"], "novo-corte.webp", { type: "image/webp" });
    mocks.put.mockResolvedValue({
      data: {
        Id: 2,
        NomeServico: "Corte premium",
        Valor: 75,
        TempoEstimadoMinutos: 45,
        ImagemServico: "uploads/novo-corte.webp",
      },
    });

    const result = await atualizarServico(2, {
      NomeServico: "Corte premium",
      Valor: 75,
      TempoEstimadoMinutos: 45,
      ImagemServico: imagem,
    });

    const [, formData] = mocks.put.mock.calls[0];
    expect(mocks.put).toHaveBeenCalledWith(
      "/Servico/2",
      expect.any(FormData),
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    expect(formData.get("NomeServico")).toBe("Corte premium");
    expect(formData.get("ImagemServico")).toBe(imagem);
    expect(result.NomeServico).toBe("Corte premium");
  });
});
