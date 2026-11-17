import api from "./api";

export type ModalidadePagamento = "PRESENCIAL" | "ONLINE" | "AMBOS";
export type ConfiguracaoPagamento = {
  Modalidade: ModalidadePagamento;
  OnlineDisponivel: boolean;
  ContaConectada: boolean;
  ContaStripe?: string | null;
  TarifaCartaoBps?: number;
  TarifaCartaoFixaCentavos?: number;
};

// Mesmo arredondamento do backend. Esta é uma prévia; o backend define o valor final.
export function calcularTotalOnline(valorServico: number, config: ConfiguracaoPagamento) {
  const centavos = Math.round(valorServico * 100);
  const percentual = config.TarifaCartaoBps ?? 399;
  const fixa = config.TarifaCartaoFixaCentavos ?? 39;
  if (!Number.isSafeInteger(centavos) || centavos <= 0 ||
      !Number.isSafeInteger(percentual) || percentual < 0 || percentual >= 10000 ||
      !Number.isSafeInteger(fixa) || fixa < 0) return null;
  const totalCentavos = Math.ceil((centavos + fixa) * 10000 / (10000 - percentual));
  return {
    valorServico: centavos / 100,
    tarifa: (totalCentavos - centavos) / 100,
    total: totalCentavos / 100,
  };
}

export async function consultarPagamentoPublico(recebedorId: number) {
  const { data } = await api.get<ConfiguracaoPagamento>(`/pagamentos-agendamento/configuracao/${recebedorId}`);
  return data;
}
export async function consultarMinhaConfiguracaoPagamento() {
  const { data } = await api.get<ConfiguracaoPagamento>("/pagamentos-agendamento/minha-configuracao");
  return data;
}
export async function salvarModalidadePagamento(modalidade: ModalidadePagamento) {
  await api.put("/pagamentos-agendamento/minha-configuracao", { Modalidade: modalidade });
}
export async function conectarContaRecebedora() {
  const { data } = await api.post<{ url: string }>("/pagamentos-agendamento/conectar-stripe");
  if (!data.url) throw new Error("Não foi possível obter o endereço de conexão da Stripe.");
  window.location.assign(data.url);
}
export async function registrarPagamentoPresencial(agendamentoId: number) {
  await api.post(`/pagamentos-agendamento/agendamento/${agendamentoId}/presencial`);
}
export async function iniciarPagamentoOnline(agendamentoId: number) {
  const { data } = await api.post<{url: string}>(`/pagamentos-agendamento/agendamento/${agendamentoId}/checkout`);
  if (!data.url) throw new Error("A Stripe não retornou uma página de pagamento.");
  window.location.assign(data.url);
}
export type EstadoPagamento = {
  status: "NAO_INICIADO" | "PENDENTE" | "PAGO" | "FALHOU" | "REEMBOLSADO";
  metodo?: "PRESENCIAL" | "ONLINE";
  valor: number;
};
export async function consultarPagamentoAgendamento(id: number) {
  const { data } = await api.get<EstadoPagamento>(`/pagamentos-agendamento/agendamento/${id}`);
  return data;
}

export type PagamentoPresencialPendente = {
  AgendamentoId: number;
  Cliente: string;
  Valor: number;
  DataAgendamento: string;
};
export async function listarPagamentosPresenciaisPendentes() {
  const { data } = await api.get<PagamentoPresencialPendente[]>("/pagamentos-agendamento/pendentes");
  return data;
}
export async function confirmarRecebimentoPresencial(agendamentoId: number) {
  await api.patch(`/pagamentos-agendamento/agendamento/${agendamentoId}/confirmar-presencial`);
}
