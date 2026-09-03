import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("./api", () => ({
  default: {
    get: mocks.get,
  },
}));

import { gerarRelatorioPdf, nomeArquivoRelatorio } from "./relatorio-service";

describe("relatorio-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("solicita o PDF mensal autenticado ao backend", async () => {
    const pdf = new Blob(["%PDF"], { type: "application/pdf" });
    mocks.get.mockResolvedValue({ data: pdf });

    const result = await gerarRelatorioPdf("resumo-financeiro", 2026, 8);

    expect(mocks.get).toHaveBeenCalledWith("Relatorios/resumo-financeiro", {
      params: { ano: 2026, mes: 8 },
      responseType: "blob",
      timeout: 20_000,
    });
    expect(result).toBe(pdf);
  });

  it("monta o mesmo nome de arquivo usado pelo backend", () => {
    expect(nomeArquivoRelatorio("agenda-mensal", 2026, 8)).toBe(
      "agenda-mensal-2026-08.pdf",
    );
  });
});
