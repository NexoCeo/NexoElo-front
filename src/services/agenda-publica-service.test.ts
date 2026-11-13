import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("./api", () => ({ default: apiMock }));

import { listarEmpresasParaCadastro } from "./agenda-publica-service";

describe("pré-carregamento de empresas para cadastro", () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    window.sessionStorage.clear();
  });

  it("pré-carrega o catálogo inteiro sem consultar GPS ou pedir cidade", async () => {
    apiMock.get.mockResolvedValue({
      data: [{ IdUsuario: 990, Nome: "Barbearia Shop" }],
    });

    const companies = await listarEmpresasParaCadastro();
    expect(companies).toEqual([{ Id: 990, Nome: "Barbearia Shop" }]);
    expect(apiMock.get).toHaveBeenCalledOnce();
    expect(apiMock.get).toHaveBeenCalledWith("/Profissional/empresas");

    // Navegações futuras usam o resultado em cache em vez de acessar a API.
    const cached = await listarEmpresasParaCadastro();
    expect(cached).toEqual(companies);
    expect(apiMock.get).toHaveBeenCalledOnce();
    expect(window.sessionStorage.getItem("nexoelo:cadastro-empresas:v2:0"))
      .toContain("Barbearia Shop");
  });

  it("normaliza nomes de empresas recebidos em caixa alta, preservando marcas já formatadas", async () => {
    apiMock.get.mockResolvedValue({
      data: [
        { IdUsuario: 601, Nome: "BARBEARIA DO PEDRO" },
        { IdUsuario: 602, Nome: "BARBEARIA TESTE LTDA" },
        { IdUsuario: 603, Nome: "NexoCeo" },
      ],
    });
    const companies = await listarEmpresasParaCadastro(9010);
    expect(companies).toEqual([
      { Id: 601, Nome: "Barbearia do Pedro" },
      { Id: 602, Nome: "Barbearia Teste Ltda" },
      { Id: 603, Nome: "NexoCeo" },
    ]);
  });

  it("reaproveita a lista em cache quando a mesma cidade é consultada novamente", async () => {
    apiMock.get.mockResolvedValue({
      data: [{ IdUsuario: 501, Nome: "Barbearia Shop" }],
    });

    const first = await listarEmpresasParaCadastro(9001);
    const second = await listarEmpresasParaCadastro(9001);

    expect(first).toEqual([{ Id: 501, Nome: "Barbearia Shop" }]);
    expect(second).toEqual(first);
    expect(apiMock.get).toHaveBeenCalledOnce();
    expect(apiMock.get).toHaveBeenCalledWith("/Profissional/empresas", {
      params: { cidadeId: 9001 },
    });
  });

  it("compartilha uma requisição em andamento para evitar consultas duplicadas", async () => {
    let finish!: (value: { data: Array<{ IdUsuario: number; Nome: string }> }) => void;
    apiMock.get.mockReturnValue(new Promise(resolve => { finish = resolve; }));

    const requestA = listarEmpresasParaCadastro(9002);
    const requestB = listarEmpresasParaCadastro(9002);
    expect(apiMock.get).toHaveBeenCalledOnce();

    finish({ data: [{ IdUsuario: 502, Nome: "Estúdio Exemplo" }] });
    expect(await requestA).toEqual([{ Id: 502, Nome: "Estúdio Exemplo" }]);
    expect(await requestB).toEqual([{ Id: 502, Nome: "Estúdio Exemplo" }]);
  });

  it("busca novamente após uma falha e não reutiliza erro como cache", async () => {
    apiMock.get.mockRejectedValueOnce(new Error("network"));
    await expect(listarEmpresasParaCadastro(9003)).rejects.toThrow("network");

    apiMock.get.mockResolvedValueOnce({ data: [{ IdUsuario: 503, Nome: "Empresa Recuperada" }] });
    expect(await listarEmpresasParaCadastro(9003)).toEqual([
      { Id: 503, Nome: "Empresa Recuperada" },
    ]);
    expect(apiMock.get).toHaveBeenCalledTimes(2);
  });
});
