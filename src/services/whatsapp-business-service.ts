import api from "./api";

export type WhatsAppStatus = {
  conectado: boolean;
  numero?: string;
  nomeExibicao?: string;
  status?: string;
  faturamento?: "META_DIRETO" | "PARCEIRO";
  confirmacoes: boolean;
  lembretes: boolean;
  promocoes: boolean;
  consumoMes?: number;
  mensagensEnviadas?: number;
  mensagensEntregues?: number;
  mensagensFalhas?: number;
};

export type WhatsAppPreferencias = Pick<WhatsAppStatus, "confirmacoes" | "lembretes" | "promocoes"> & {
  horasAntecedencia: number;
  limiteMensalReais: number;
};

export async function buscarStatusWhatsApp() {
  const { data } = await api.get<WhatsAppStatus>("WhatsappBusiness/status");
  return data;
}
export async function obterConfiguracaoCadastro() {
  const { data } = await api.get<{ appId: string; configurationId: string }>("WhatsappBusiness/signup-config");
  return data;
}
export async function concluirCadastro(code: string, wabaId: string, phoneNumberId: string) {
  await api.post("WhatsappBusiness/conectar", { code, wabaId, phoneNumberId });
}
export async function salvarPreferenciasWhatsApp(preferencias: WhatsAppPreferencias) {
  await api.put("WhatsappBusiness/preferencias", preferencias);
}
export async function desconectarWhatsApp() {
  await api.post("WhatsappBusiness/desconectar");
}
