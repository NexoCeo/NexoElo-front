import api from "@/services/api";
export type NotificacaoAgendamento = {
  Id: number;
  AgendamentoId: number;
  Titulo: string;
  Mensagem: string;
  DataAgendamento: string;
  Lida: boolean;
};
export async function listarNotificacoesAgendamento() {
  const { data } = await api.get<NotificacaoAgendamento[]>("/notificacoes-agendamento");
  return data;
}
export async function marcarNotificacaoAgendamentoLida(id: number) {
  await api.put(`/notificacoes-agendamento/${id}/lida`);
}
export async function marcarTodasNotificacoesAgendamentoLidas() {
  await api.put("/notificacoes-agendamento/marcar-todas-lidas");
}
