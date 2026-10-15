import api from "./api";

export type PlanoNome = "GRATIS" | "BASICO" | "INTERMEDIARIO" | "AVANCADO" | "SEM_PLANO";

export interface AssinaturaAtual {
  Plano: PlanoNome;
  AcessoAtivo: boolean;
  RelatoriosLiberados: boolean;
  LimiteServicos: number;
  LimiteProfissionais: number;
  DataFim: string | null;
  Status: string;
  ServicosCadastrados: number;
  ProfissionaisVinculados: number;
}

export const planos = [
  { id: "BASICO", nome: "Básico", valor: 29.99, servicos: "4 serviços", profissionais: "2 profissionais", relatorios: false },
  { id: "INTERMEDIARIO", nome: "Intermediário", valor: 49.99, servicos: "8 serviços", profissionais: "4 profissionais", relatorios: true },
  { id: "AVANCADO", nome: "Avançado", valor: 99.99, servicos: "Serviços ilimitados", profissionais: "Profissionais ilimitados", relatorios: true },
] as const;

export async function consultarAssinatura() {
  const response = await api.get<AssinaturaAtual>("Assinatura/minha");
  return response.data;
}

export async function iniciarCheckout(usuarioId: number, plano: "BASICO" | "INTERMEDIARIO" | "AVANCADO") {
  const response = await api.post<{ Url: string }>("Assinatura/checkout", { UsuarioId: usuarioId, Plano: plano });
  if (!response.data.Url) throw new Error("O checkout nao retornou uma URL.");
  window.location.assign(response.data.Url);
}

export async function abrirPortal(usuarioId: number) {
  const response = await api.post<{ Url: string }>("Assinatura/portal", { UsuarioId: usuarioId });
  if (!response.data.Url) throw new Error("O portal de cobranca nao retornou uma URL.");
  window.location.assign(response.data.Url);
}

export async function alterarPlano(usuarioId: number, plano: "BASICO" | "INTERMEDIARIO" | "AVANCADO", servicosAtivos?: number[], profissionaisAtivos?: number[]) {
  await api.post("Assinatura/alterar-plano", { UsuarioId: usuarioId, Plano: plano, ServicosAtivos: servicosAtivos, ProfissionaisAtivos: profissionaisAtivos });
}

export interface RecursoPlano { Tipo: "SERVICO" | "PROFISSIONAL"; Id: number; Nome: string; }
export async function listarRecursosPlano() {
  const { data } = await api.get<RecursoPlano[]>("Assinatura/recursos");
  return data;
}
