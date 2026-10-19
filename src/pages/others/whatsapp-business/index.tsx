import { useEffect, useState, type CSSProperties } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { FaWhatsapp, FaCheckCircle, FaExclamationTriangle, FaPaperPlane, FaRegClock, FaBullhorn, FaExternalLinkAlt, FaCog, FaShieldAlt, FaArrowRight } from "react-icons/fa";
import { buscarStatusWhatsApp, obterConfiguracaoCadastro, concluirCadastro, salvarPreferenciasWhatsApp, desconectarWhatsApp, type WhatsAppStatus, type WhatsAppPreferencias } from "@/services/whatsapp-business-service";
import styles from "./style.module.css";

declare global { interface Window { FB?: { init: (options: Record<string, unknown>) => void; login: (callback: (data: { authResponse?: { code?: string } }) => void, options: Record<string, unknown>) => void; }; } }

const defaults: WhatsAppPreferencias = { confirmacoes: true, lembretes: true, promocoes: false, horasAntecedencia: 24, limiteMensalReais: 50 };
const reais = (value: number, lang: "pt" | "en") => new Intl.NumberFormat(lang === "en" ? "en-US" : "pt-BR", { style: "currency", currency: "BRL" }).format(value);
async function carregarFacebookSdk(appId: string, language: "pt" | "en"): Promise<void> {
  if (!document.getElementById("facebook-jssdk")) {
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = `https://connect.facebook.net/${language === "en" ? "en_US" : "pt_BR"}/sdk.js`;
    script.async = true;
    document.body.appendChild(script);
  }
  const start = Date.now();
  while (!window.FB) {
    if (Date.now() - start > 12000) throw new Error(language === "en" ? "Unable to load the secure Meta connection." : "Não foi possível carregar a conexão segura da Meta.");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  window.FB.init({ appId, cookie: true, xfbml: false, version: "v23.0" });
}
export default function WhatsAppBusiness() {
  const { theme } = useTheme();
  const { t, lang } = useLanguage();
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
      if (!config.appId || !config.configurationId) throw new Error(t("wh.missingConfig"));
      await carregarFacebookSdk(config.appId, lang);
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
          window.FB!.login(response => response.authResponse?.code ? resolve(response.authResponse.code) : reject(new Error(t("wh.authCancelled"))),
            { config_id: config.configurationId, response_type: "code", override_default_response_type: true, extras: { setup: {} } });
        });
        if (!wabaId || !phoneNumberId) throw new Error(t("wh.missingIds"));
        await concluirCadastro(authCode, wabaId, phoneNumberId);
        setMessage(t("wh.connectionRequested"));
        await refresh();
      } finally { window.removeEventListener("message", handleMessage); }
    } catch (error) { setMessage(error instanceof Error ? error.message : t("wh.connectFailed")); }
    finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setMessage("");
    try { await salvarPreferenciasWhatsApp(preferences); setMessage(t("wh.saved")); await refresh(); }
    catch { setMessage(t("wh.saveFailed")); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    if (!window.confirm(t("wh.disconnectConfirm"))) return;
    setBusy(true);
    try { await desconectarWhatsApp(); await refresh(); setMessage(t("wh.disconnected")); }
    catch { setMessage(t("wh.disconnectFailed")); }
    finally { setBusy(false); }
  }
  const connected = Boolean(status?.conectado);
  const metrics = [
    { label: t("wh.sent"), value: status?.mensagensEnviadas ?? 0, icon: <FaPaperPlane /> },
    { label: t("wh.delivered"), value: status?.mensagensEntregues ?? 0, icon: <FaCheckCircle /> },
    { label: t("wh.failed"), value: status?.mensagensFalhas ?? 0, icon: <FaExclamationTriangle /> },
    { label: t("wh.cost"), value: reais(status?.consumoMes ?? 0, lang), icon: <FaShieldAlt /> }
  ];
  const automations = [
    { key: "confirmacoes", label: t("wh.confirmations"), detail: t("wh.confirmationDesc"), icon: <FaCheckCircle /> },
    { key: "lembretes", label: t("wh.reminders"), detail: t("wh.reminderDesc"), icon: <FaRegClock /> },
    { key: "promocoes", label: t("wh.promotions"), detail: t("wh.promotionDesc"), icon: <FaBullhorn /> }
  ] as const;
  return <main className={styles.page} style={vars}>
    <header className={styles.hero}>
      <div className={styles.heroContent}>
        <div className={styles.heroIcon}><FaWhatsapp aria-hidden="true" /></div>
        <div className={styles.heroText}>
          <div className={styles.eyebrow}>{t("wh.breadcrumb1")} <span>/</span> {t("wh.breadcrumb2")}</div>
          <h1 className={styles.title}>WhatsApp Business</h1>
          <p className={styles.muted}>{t("wh.subtitle")}</p>
        </div>
      </div>
      <div className={styles.heroAside}><span className={connected ? styles.connected : styles.disconnected}><span className={styles.statusDot} /> {connected ? t("wh.connected") : t("wh.notConnected")}</span></div>
    </header>
    {!available && <div role="status" className={styles.notice}><FaExclamationTriangle aria-hidden="true" /><span><strong>{t("wh.preparing")}</strong> {t("wh.preparingDesc")}</span></div>}
    {message && <div role="status" className={styles.feedback}><FaCheckCircle aria-hidden="true" /><span>{message}</span></div>}
    <section className={styles.connectCard} aria-label={t("wh.connectionAria")}>
      <div className={styles.connectCopy}>
        <span className={styles.sectionKicker}>{t("wh.official")}</span>
        <h2>{connected ? t("wh.accountLinked") : t("wh.connectHeading")}</h2>
        <p className={styles.muted}>{connected ? t("wh.accountLinkedDesc") : t("wh.connectDesc")}</p>
        {connected && <div className={styles.phoneInfo}><FaWhatsapp aria-hidden="true" /><div><strong>{status?.numero || t("wh.authorizedNumber")}</strong><small>{status?.nomeExibicao || "WhatsApp Business"} · {status?.status || t("wh.connectedState")}</small></div></div>}
      </div>
      <div className={styles.connectActions}>
        {connected ? <button className={styles.secondary} disabled={busy} onClick={disconnect}>{t("wh.disconnect")}</button> : <button className={styles.button} disabled={busy || !available} onClick={connect}><FaWhatsapp aria-hidden="true" />{busy ? t("wh.connecting") : t("wh.connect")}<FaArrowRight aria-hidden="true" /></button>}
        <span className={styles.microCopy}>{t("wh.secureMeta")}</span>
      </div>
    </section>
    <section className={styles.metricsSection} aria-labelledby="metrics-title">
      <div className={styles.sectionHeading}><div><span className={styles.sectionKicker}>{t("wh.overview")}</span><h2 id="metrics-title">{t("wh.summary")}</h2></div><small className={styles.muted}>{t("wh.metricsNote")}</small></div>
      <div className={styles.metricGrid}>{metrics.map(item => <div className={styles.metricCard} key={item.label}><div className={styles.metricIcon}>{item.icon}</div><span className={styles.metricLabel}>{item.label}</span><strong className={styles.metricValue}>{item.value}</strong></div>)}</div>
    </section>
    <section className={styles.settingsGrid}>
      <div className={styles.card}>
        <div className={styles.cardTop}><div className={styles.cardTopIcon}><FaCog aria-hidden="true" /></div><div><span className={styles.sectionKicker}>{t("wh.preferences")}</span><h2>{t("wh.automations")}</h2><p className={styles.muted}>{t("wh.automationsDesc")}</p></div></div>
        <div className={styles.automationList}>{automations.map(item => <label className={styles.automationRow} key={item.key}><span className={styles.automationIcon}>{item.icon}</span><span className={styles.automationText}><strong>{item.label}</strong><small>{item.detail}</small></span><span className={styles.switch}><input type="checkbox" checked={preferences[item.key]} disabled={!connected || busy} onChange={e => setPreferences(old => ({...old, [item.key]: e.target.checked}))} /><span className={styles.switchTrack} /></span></label>)}</div>
        <div className={styles.inlineNotice}><FaExclamationTriangle aria-hidden="true" /> {t("wh.automationsWarning")}</div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardTop}><div className={styles.cardTopIcon}><FaRegClock aria-hidden="true" /></div><div><span className={styles.sectionKicker}>{t("wh.control")}</span><h2>{t("wh.sendSettings")}</h2><p className={styles.muted}>{t("wh.sendSettingsDesc")}</p></div></div>
        <div className={styles.formFields}>
          <label className={styles.label} htmlFor="horas">{t("wh.reminderHours")} <span>{t("wh.hoursUnit")}</span></label>
          <input id="horas" className={styles.input} type="number" min={1} max={168} value={preferences.horasAntecedencia} disabled={!connected || busy} onChange={e => setPreferences(old => ({...old, horasAntecedencia: Number(e.target.value)}))} />
          <label className={styles.label} htmlFor="limite">{t("wh.monthlyBudget")} <span>(R$)</span></label>
          <input id="limite" className={styles.input} type="number" min={0} step={5} value={preferences.limiteMensalReais} disabled={!connected || busy} onChange={e => setPreferences(old => ({...old, limiteMensalReais: Number(e.target.value)}))} />
          <p className={styles.helperText}>{t("wh.budgetWarning")}</p>
          <button type="button" className={styles.button} disabled={!connected || busy} onClick={save}>{t("wh.save")} <FaArrowRight aria-hidden="true" /></button>
        </div>
      </div>
    </section>
    <section className={styles.billingCard}>
      <div className={styles.billingIcon}><FaShieldAlt aria-hidden="true" /></div>
      <div className={styles.billingContent}><h2>{t("wh.billing")}</h2><p className={styles.muted}>{t("wh.billingDesc")}</p></div>
      <a className={styles.billingLink} href="https://business.facebook.com/" target="_blank" rel="noreferrer">{t("wh.openMeta")} <FaExternalLinkAlt aria-hidden="true" /></a>
    </section>
  </main>;
}
