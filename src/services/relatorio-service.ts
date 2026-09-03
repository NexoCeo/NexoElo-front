import api from "./api";

export type TipoRelatorio =
  | "resumo-financeiro"
  | "servicos-mais-realizados"
  | "agenda-mensal";

export async function gerarRelatorioPdf(
  tipo: TipoRelatorio,
  ano: number,
  mes: number,
) {
  const response = await api.get<Blob>(`Relatorios/${tipo}`, {
    params: { ano, mes },
    responseType: "blob",
    timeout: 20_000,
  });

  return response.data;
}

export function nomeArquivoRelatorio(
  tipo: TipoRelatorio,
  ano: number,
  mes: number,
) {
  return `${tipo}-${ano.toString().padStart(4, "0")}-${mes
    .toString()
    .padStart(2, "0")}.pdf`;
}
