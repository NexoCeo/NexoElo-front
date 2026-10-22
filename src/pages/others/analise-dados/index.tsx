import { formatPersonName } from "@/context/UserContext";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { FaBullhorn, FaChartLine, FaClock, FaEnvelope, FaUserClock, FaUsers } from "react-icons/fa";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { listarHistoricoAgendamentos } from "@/services/agendamento-service";
import type { Agendamento } from "@/types/agendamento";
import LoadingState from "@/components/loading-state";
import styles from "./style.module.css";
import { useLanguage } from "@/context/LanguageContext";

type ClienteRetencao = {
  id: number;
  nome: string;
  ultimaVisita: Date;
  visitas: number;
  diasSemVisitar: number;
};
type Filtro = 30 | 60 | 90;
function diasDesde(data: Date, referencia: Date) {
  const diaAtual = new Date(referencia.getFullYear(), referencia.getMonth(), referencia.getDate()).getTime();
  const diaVisita = new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime();
  return Math.floor((diaAtual - diaVisita) / 86400000);
}
function formatarData(data: Date, lang: "pt" | "en") {
  return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", { day: "2-digit", month: "short", year: "numeric" }).format(data);
}
function agruparClientes(agendamentos: Agendamento[], referencia: Date): ClienteRetencao[] {
  const clientes = new Map<number, { nome: string; ultimaVisita: Date; visitas: number }>();
  for (const agendamento of agendamentos) {
    if (agendamento.ClienteId <= 0 || agendamento.Status.toUpperCase() !== "CONCLUIDO") continue;
    const data = new Date(agendamento.DataAgendamento);
    if (!Number.isFinite(data.getTime()) || data > referencia) continue;
    const anterior = clientes.get(agendamento.ClienteId);
    clientes.set(agendamento.ClienteId, {
      nome: formatPersonName(agendamento.ClienteNome) || anterior?.nome || "Cliente #" + agendamento.ClienteId,
      ultimaVisita: anterior && anterior.ultimaVisita > data ? anterior.ultimaVisita : data,
      visitas: (anterior?.visitas || 0) + 1,
    });
  }
  return Array.from(clientes, ([id, data]) => ({
    id, ...data, diasSemVisitar: diasDesde(data.ultimaVisita, referencia),
  })).sort((a, b) => b.diasSemVisitar - a.diasSemVisitar);
}

export default function AnaliseDados() {
  const { theme } = useTheme();
  const { t, lang } = useLanguage();
  const { usuario } = useUser();
  const [historico, setHistorico] = useState<Agendamento[]>([]);
  const [filtro, setFiltro] = useState<Filtro>(30);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const permitido = usuario?.Papel === "EMPRESA" || usuario?.Papel === "AUTONOMO";
  useEffect(() => {
    if (!usuario?.Id || !permitido) { setCarregando(false); return; }
    let ativo = true;
    setCarregando(true);
    listarHistoricoAgendamentos(usuario.Id)
      .then(items => { if (ativo) { setHistorico(items); setErro(""); } })
      .catch(() => { if (ativo) setErro(t("analytics.error")); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [usuario?.Id, permitido]);

  const clientes = useMemo(() => agruparClientes(historico, new Date()), [historico]);
  const inativos = useMemo(() => clientes.filter(cliente => cliente.diasSemVisitar >= filtro), [clientes, filtro]);
  const cssVars = {
    "--analysis-panel": theme.colors.background2,
    "--analysis-text": theme.colors.text,
    "--analysis-muted": theme.colors.inactive,
    "--analysis-border": theme.colors.bottom,
    "--analysis-primary": theme.colors.primary,
  } as CSSProperties;

  if (!permitido) return <main className={styles.container}>{t("analytics.notAllowed")}</main>;
  return <main className={styles.container} style={cssVars}>
    <div className={styles.grid}>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionName}><FaUserClock aria-hidden="true"/><span>{t("analytics.recovery")}</span></div>
          <p>{t("analytics.recoveryDescription")}</p>
        </div>
        <div className={styles.filterRow}>
          <span>{t("analytics.noReturn")}</span>
          <div className={styles.filters} role="group" aria-label="Período sem retorno">
            {([30, 60, 90] as const).map(valor =>
              <button key={valor} type="button" className={filtro === valor ? styles.selected : ""}
                aria-pressed={filtro === valor} onClick={() => setFiltro(valor)}>{valor} {t("analytics.days")}</button>)}
          </div>
        </div>
        {carregando ? <LoadingState label={t("analytics.loading")} compact/> : erro
          ? <p className={styles.error} role="alert">{erro}</p>
          : <>
            <div className={styles.metrics}>
              <div className={styles.metric}><FaUsers aria-hidden="true"/><strong>{clientes.length}</strong><span>{t("analytics.completedCustomers")}</span></div>
              <div className={styles.metric}><FaClock aria-hidden="true"/><strong>{inativos.length}</strong><span>{t("analytics.inactive")} {filtro}+ {t("analytics.days")}</span></div>
            </div>
            <div className={styles.listHeader}><span>{t("analytics.customer")}</span><span>{t("analytics.lastVisit")}</span><span>{t("analytics.noReturnColumn")}</span></div>
            {inativos.length ? <div className={styles.list}>
              {inativos.map(cliente => <div className={styles.client} key={cliente.id}>
                <div className={styles.clientName}><strong>{cliente.nome}</strong><small>{cliente.visitas} {t("analytics.visits")}</small></div>
                <span>{formatarData(cliente.ultimaVisita, lang)}</span><strong>{cliente.diasSemVisitar} {t("analytics.days")}</strong>
              </div>)}
            </div> : <div className={styles.empty}>{t("analytics.empty")}</div>}
            <p className={styles.note}>{t("analytics.note")}</p>
          </>}
      </section>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionName}><FaChartLine aria-hidden="true"/><span>{t("analytics.marketing")}</span></div>
          <p>{t("analytics.marketingDescription")}</p>
        </div>
        <div className={styles.comingSoon}><FaBullhorn aria-hidden="true"/><strong>{t("analytics.planning")}</strong>
          <span>{t("analytics.planningDescription")}</span>
        </div>
        <div className={styles.automation}><FaEnvelope aria-hidden="true"/><div><strong>{t("analytics.reminders")}</strong>
          <span>{t("analytics.remindersDescription")}</span></div><span className={styles.disabled}>{t("analytics.unavailable")}</span></div>
        <div className={styles.automation}><FaUsers aria-hidden="true"/><div><strong>{t("analytics.reactivation")}</strong>
          <span>{t("analytics.reactivationDescription")}</span></div><span className={styles.disabled}>Indisponível</span></div>
        <p className={styles.note}>{t("analytics.noCharges")}</p>
      </section>
    </div>
  </main>;
}
