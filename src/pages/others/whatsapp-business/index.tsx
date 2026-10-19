import { useEffect, useState, type CSSProperties } from "react";
import { useTheme } from "@/context/ThemeContext";
import { FaWhatsapp, FaCheckCircle, FaExclamationTriangle, FaPaperPlane, FaRegClock, FaBullhorn, FaExternalLinkAlt, FaCog, FaShieldAlt, FaArrowRight } from "react-icons/fa";
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
      setAvailable(response.integracaoDisponivel === true);
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
  const connected = Boolean(status?.conectado);
  const metrics = [
    { label: "Mensagens enviadas", value: status?.mensagensEnviadas ?? 0, icon: <FaPaperPlane /> },
    { label: "Entregues", value: status?.mensagensEntregues ?? 0, icon: <FaCheckCircle /> },
    { label: "Falhas", value: status?.mensagensFalhas ?? 0, icon: <FaExclamationTriangle /> },
    { label: "Consumo estimado", value: reais(status?.consumoMes ?? 0), icon: <FaShieldAlt /> }
  ];
  const automations = [
    { key: "confirmacoes", label: "Confirmações de agendamento", detail: "Preferência para informar o cliente sobre novos agendamentos.", icon: <FaCheckCircle /> },
    { key: "lembretes", label: "Lembretes de atendimento", detail: "Defina com quantas horas de antecedência avisar o cliente.", icon: <FaRegClock /> },
    { key: "promocoes", label: "Campanhas promocionais", detail: "Somente para contatos com consentimento de marketing.", icon: <FaBullhorn /> }
  ] as const;
  return <main className={styles.page} style={vars}>
    <header className={styles.hero}>
      <div className={styles.heroContent}>
        <div className={styles.heroIcon}><FaWhatsapp aria-hidden="true" /></div>
        <div className={styles.heroText}>
          <div className={styles.eyebrow}>INTEGRAÇÕES <span>/</span> COMUNICAÇÃO</div>
          <h1 className={styles.title}>WhatsApp Business</h1>
          <p className={styles.muted}>Conecte seu número, gerencie preferências e acompanhe suas mensagens em um só lugar.</p>
        </div>
      </div>
      <div className={styles.heroAside}><span className={connected ? styles.connected : styles.disconnected}><span className={styles.statusDot} /> {connected ? "Número conectado" : "Não conectado"}</span></div>
    </header>
    {!available && <div role="status" className={styles.notice}><FaExclamationTriangle aria-hidden="true" /><span><strong>Integração em preparação.</strong> A conexão será liberada após a validação das configurações da Meta e do servidor.</span></div>}
    {message && <div role="status" className={styles.feedback}><FaCheckCircle aria-hidden="true" /><span>{message}</span></div>}
    <section className={styles.connectCard} aria-label="Conexão WhatsApp">
      <div className={styles.connectCopy}>
        <span className={styles.sectionKicker}>CONEXÃO OFICIAL</span>
        <h2>{connected ? "Sua conta está vinculada" : "Tudo começa conectando seu WhatsApp"}</h2>
        <p className={styles.muted}>{connected ? "Seu número está associado a este estabelecimento." : "Autorize sua conta comercial com segurança pelo cadastro oficial da Meta. Não é necessário compartilhar senhas com o NexoElo."}</p>
        {connected && <div className={styles.phoneInfo}><FaWhatsapp aria-hidden="true" /><div><strong>{status?.numero || "Número autorizado"}</strong><small>{status?.nomeExibicao || "WhatsApp Business"} · {status?.status || "Conectado"}</small></div></div>}
      </div>
      <div className={styles.connectActions}>
        {connected ? <button className={styles.secondary} disabled={busy} onClick={disconnect}>Desconectar número</button> : <button className={styles.button} disabled={busy || !available} onClick={connect}><FaWhatsapp aria-hidden="true" />{busy ? "Conectando..." : "Conectar WhatsApp"}<FaArrowRight aria-hidden="true" /></button>}
        <span className={styles.microCopy}>Conexão segura com a Meta</span>
      </div>
    </section>
    <section className={styles.metricsSection} aria-labelledby="metrics-title">
      <div className={styles.sectionHeading}><div><span className={styles.sectionKicker}>VISÃO GERAL</span><h2 id="metrics-title">Resumo de mensagens</h2></div><small className={styles.muted}>Indicadores serão atualizados quando a coleta estiver disponível.</small></div>
      <div className={styles.metricGrid}>{metrics.map(item => <div className={styles.metricCard} key={item.label}><div className={styles.metricIcon}>{item.icon}</div><span className={styles.metricLabel}>{item.label}</span><strong className={styles.metricValue}>{item.value}</strong></div>)}</div>
    </section>
    <section className={styles.settingsGrid}>
      <div className={styles.card}>
        <div className={styles.cardTop}><div className={styles.cardTopIcon}><FaCog aria-hidden="true" /></div><div><span className={styles.sectionKicker}>PREFERÊNCIAS</span><h2>Automações</h2><p className={styles.muted}>Escolha quais recursos deseja habilitar após a ativação do serviço de mensagens.</p></div></div>
        <div className={styles.automationList}>{automations.map(item => <label className={styles.automationRow} key={item.key}><span className={styles.automationIcon}>{item.icon}</span><span className={styles.automationText}><strong>{item.label}</strong><small>{item.detail}</small></span><span className={styles.switch}><input type="checkbox" checked={preferences[item.key]} disabled={!connected || busy} onChange={e => setPreferences(old => ({...old, [item.key]: e.target.checked}))} /><span className={styles.switchTrack} /></span></label>)}</div>
        <div className={styles.inlineNotice}><FaExclamationTriangle aria-hidden="true" /> As automações ainda não enviam mensagens; dependem de templates aprovados e do serviço de envio.</div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardTop}><div className={styles.cardTopIcon}><FaRegClock aria-hidden="true" /></div><div><span className={styles.sectionKicker}>CONTROLE</span><h2>Configurações de envio</h2><p className={styles.muted}>Personalize os lembretes e o limite planejado para consumo.</p></div></div>
        <div className={styles.formFields}>
          <label className={styles.label} htmlFor="horas">Antecedência dos lembretes <span>(horas)</span></label>
          <input id="horas" className={styles.input} type="number" min={1} max={168} value={preferences.horasAntecedencia} disabled={!connected || busy} onChange={e => setPreferences(old => ({...old, horasAntecedencia: Number(e.target.value)}))} />
          <label className={styles.label} htmlFor="limite">Orçamento mensal planejado <span>(R$)</span></label>
          <input id="limite" className={styles.input} type="number" min={0} step={5} value={preferences.limiteMensalReais} disabled={!connected || busy} onChange={e => setPreferences(old => ({...old, limiteMensalReais: Number(e.target.value)}))} />
          <p className={styles.helperText}>O orçamento informado ainda não limita cobranças ou envios. A fiscalização de custos precisa ser implementada no servidor.</p>
          <button type="button" className={styles.button} disabled={!connected || busy} onClick={save}>Salvar preferências <FaArrowRight aria-hidden="true" /></button>
        </div>
      </div>
    </section>
    <section className={styles.billingCard}>
      <div className={styles.billingIcon}><FaShieldAlt aria-hidden="true" /></div>
      <div className={styles.billingContent}><h2>Pagamento e faturamento</h2><p className={styles.muted}>A assinatura NexoElo é independente das cobranças do WhatsApp. Quando o faturamento direto estiver habilitado, cartões e faturas serão gerenciados na conta comercial da Meta.</p></div>
      <a className={styles.billingLink} href="https://business.facebook.com/" target="_blank" rel="noreferrer">Abrir Meta Business <FaExternalLinkAlt aria-hidden="true" /></a>
    </section>
  </main>;
}
