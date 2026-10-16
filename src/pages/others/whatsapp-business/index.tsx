import { useEffect, useState, type CSSProperties } from "react";
import { useTheme } from "@/context/ThemeContext";
import { FaWhatsapp, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import { buscarStatusWhatsApp, obterConfiguracaoCadastro, concluirCadastro, salvarPreferenciasWhatsApp, desconectarWhatsApp, type WhatsAppStatus, type WhatsAppPreferencias } from "@/services/whatsapp-business-service";
import styles from "./style.module.css";

declare global { interface Window { FB?: { init: (options: Record<string, unknown>) => void; login: (callback: (data: { authResponse?: { code?: string } }) => void, options: Record<string, unknown>) => void; }; } }

const defaults: WhatsAppPreferencias = { confirmacoes: true, lembretes: true, promocoes: false, horasAntecedencia: 24, limiteMensalReais: 50 };
const reais = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
async function carregarFacebookSdk(appId: string): Promise<void> {
  if (!document.getElementById("facebook-jssdk")) {
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/pt_BR/sdk.js";
    script.async = true;
    document.body.appendChild(script);
  }
  const start = Date.now();
  while (!window.FB) {
    if (Date.now() - start > 12000) throw new Error("Não foi possível carregar a conexão segura da Meta.");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  window.FB.init({ appId, cookie: true, xfbml: false, version: "v23.0" });
}
export default function WhatsAppBusiness() {
  const { theme } = useTheme();
  const vars = { "--wh-text": theme.colors.text, "--wh-muted": theme.colors.inactive, "--wh-panel": theme.colors.background2, "--wh-border": theme.colors.bottom, "--wh-primary": theme.colors.primary } as CSSProperties;
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [preferences, setPreferences] = useState<WhatsAppPreferencias>(defaults);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [available, setAvailable] = useState(false);

  async function refresh() {
    try {
      const response = await buscarStatusWhatsApp();
      setStatus(response);
      setPreferences(old => ({ ...old, confirmacoes: response.confirmacoes, lembretes: response.lembretes, promocoes: response.promocoes }));
      setAvailable(true);
    } catch { setAvailable(false); }
  }
  useEffect(() => { void refresh(); }, []);

  async function connect() {
    setBusy(true); setMessage("");
    try {
      const config = await obterConfiguracaoCadastro();
      if (!config.appId || !config.configurationId) throw new Error("A integração da Meta ainda não foi configurada no servidor.");
      await carregarFacebookSdk(config.appId);
      // Meta Embedded Signup: o popup é propriedade da Meta, não um formulário de cartão do NexoElo.
      let wabaId = ""; let phoneNumberId = "";
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") return;
        try {
          const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          if (data?.type !== "WA_EMBEDDED_SIGNUP" || data?.event !== "FINISH") return;
          wabaId = String(data.data?.waba_id || "");
          phoneNumberId = String(data.data?.phone_number_id || "");
        } catch { /* Mensagens de outros SDKs são ignoradas. */ }
      };
      window.addEventListener("message", handleMessage);
      try {
        const authCode = await new Promise<string>((resolve, reject) => {
          window.FB!.login(response => response.authResponse?.code ? resolve(response.authResponse.code) : reject(new Error("Autorização cancelada ou não concluída.")),
            { config_id: config.configurationId, response_type: "code", override_default_response_type: true, extras: { setup: {} } });
        });
        if (!wabaId || !phoneNumberId) throw new Error("A Meta não retornou os identificadores do número. Tente novamente.");
        await concluirCadastro(authCode, wabaId, phoneNumberId);
        setMessage("Conexão solicitada. Verificando a ativação da conta.");
        await refresh();
      } finally { window.removeEventListener("message", handleMessage); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível concluir a conexão."); }
    finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setMessage("");
    try { await salvarPreferenciasWhatsApp(preferences); setMessage("Preferências salvas."); await refresh(); }
    catch { setMessage("Não foi possível salvar as preferências. Verifique a integração da API."); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    if (!window.confirm("Desconectar o WhatsApp e interromper as automações?")) return;
    setBusy(true);
    try { await desconectarWhatsApp(); await refresh(); setMessage("WhatsApp desconectado."); }
    catch { setMessage("Não foi possível desconectar."); }
    finally { setBusy(false); }
  }
  return <main className={styles.page} style={vars}>
    <div className={styles.header}>
      <div><small>ANÁLISE DE DADOS / WHATSAPP BUSINESS</small><h1 className={styles.title}><FaWhatsapp aria-hidden="true" /> WhatsApp Business</h1>
      <p className={styles.muted}>Gerencie conexão, confirmações, lembretes, promoções e consumo de mensagens da sua empresa.</p></div>
    </div>
    {!available && <div role="status" className={styles.notice}><FaExclamationTriangle aria-hidden="true" /> O módulo de WhatsApp Cloud API ainda não foi habilitado no backend. Os envios permanecem desligados até a configuração oficial da Meta.</div>}
    {message && <p role="status" className={styles.notice}>{message}</p>}
    <section className={styles.card}>
      <h2>Conexão com a Meta</h2>
      {status?.conectado ? <>
        <p><FaCheckCircle color="#27956c" /> WhatsApp conectado: <strong>{status.numero || "Número autorizado"}</strong></p>
        <p className={styles.muted}>Nome de exibição: {status.nomeExibicao || "Não informado"} · Situação: {status.status || "Conectado"}</p>
        <div className={styles.actions}><button className={styles.secondary} type="button" disabled={busy} onClick={disconnect}>Desconectar</button></div>
      </> : <>
        <p>Conecte o número comercial usando o cadastro oficial do WhatsApp Embedded Signup. A autenticação ocorre em uma janela segura da Meta.</p>
        <button className={styles.button} type="button" disabled={busy || !available} onClick={connect}>{busy ? "Aguarde..." : "Conectar WhatsApp Business"}</button>
        <p className={styles.muted}>O faturamento das mensagens será separado da assinatura NexoElo quando configurado no modelo de cobrança direta da Meta. O cadastro do cartão pode exigir acesso ao ambiente de faturamento da Meta.</p>
      </>}
    </section>
    <section className={styles.grid} aria-label="Indicadores de mensagens">
      {[["Mensagens enviadas", status?.mensagensEnviadas ?? 0],["Entregues",status?.mensagensEntregues ?? 0],["Falhas",status?.mensagensFalhas ?? 0],["Consumo estimado",reais(status?.consumoMes ?? 0)]].map(([label,value]) =>
        <div className={styles.card} key={label}><span className={styles.muted}>{label}</span><strong className={styles.metric}>{value}</strong></div>)}
    </section>
    <section className={styles.card}>
      <h2>Automações de mensagens</h2>
      <p className={styles.muted}>As mensagens automáticas exigem modelos previamente aprovados pela Meta e consentimento dos destinatários, quando aplicável.</p>
      {([["confirmacoes","Confirmações de agendamento"],["lembretes","Lembretes antes do atendimento"],["promocoes","Promoções (somente clientes com consentimento)"]] as const).map(([key,label]) =>
        <label className={styles.toggle} key={key}><input type="checkbox" checked={preferences[key]} disabled={!status?.conectado || busy} onChange={e => setPreferences(old => ({...old,[key]:e.target.checked}))}/><span>{label}</span></label>)}
      <label className={styles.label} htmlFor="horas">Antecedência do lembrete (horas)</label>
      <input id="horas" className={styles.input} type="number" min={1} max={168} value={preferences.horasAntecedencia} disabled={!status?.conectado || busy} onChange={e => setPreferences(old => ({...old, horasAntecedencia: Number(e.target.value)}))} />
      <label className={styles.label} htmlFor="limite">Orçamento mensal máximo autorizado para mensagens (R$)</label>
      <input id="limite" className={styles.input} type="number" min={0} step={5} value={preferences.limiteMensalReais} disabled={!status?.conectado || busy} onChange={e => setPreferences(old => ({...old, limiteMensalReais: Number(e.target.value)}))} />
      <p className={styles.muted}>O limite precisa ser aplicado no backend antes de cada envio. Não substitui limites ou cobranças da Meta.</p>
      <button type="button" className={styles.button} disabled={!status?.conectado || busy} onClick={save}>Salvar configurações</button>
    </section>
    <section className={styles.card}>
      <h2>Pagamento e consumo</h2><p>Assinatura NexoElo e mensagens WhatsApp são cobranças independentes quando o estabelecimento utiliza faturamento direto da Meta.</p>
      <p className={styles.muted}>Para gerenciar cartão, faturas ou pendências, utilize a área de faturamento da conta comercial Meta responsável pelo número. O NexoElo não recebe dados de cartão da Meta.</p>
      <a href="https://business.facebook.com/" target="_blank" rel="noreferrer">Abrir Meta Business <span aria-hidden="true">↗</span></a>
    </section>
  </main>;
}
