import { formatPersonName } from "@/context/UserContext";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { FaBullhorn, FaChartLine, FaClock, FaEnvelope, FaUserClock, FaUsers, FaTimes } from "react-icons/fa";
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
  const todosAgendamentos = useMemo(() => [...historico].sort((a, b) =>
    new Date(b.DataAgendamento).getTime() - new Date(a.DataAgendamento).getTime()), [historico]);
  const contagens = useMemo(() => ({
    agendado: historico.filter(item => item.Status.toUpperCase() === "AGENDADO").length,
    concluido: historico.filter(item => item.Status.toUpperCase() === "CONCLUIDO").length,
    cancelado: historico.filter(item => item.Status.toUpperCase() === "CANCELADO").length,
  }), [historico]);
  const [anoGrafico, setAnoGrafico] = useState(() => new Date().getFullYear());
  const [mesDetalhe, setMesDetalhe] = useState<number | null>(null);
  const [servicoDetalhe, setServicoDetalhe] = useState<number | null>(null);
  const [statusGrafico, setStatusGrafico] = useState<"TODOS" | "AGENDADO" | "CONCLUIDO" | "CANCELADO">("TODOS");
  const anosDisponiveis = useMemo(() => Array.from(new Set([
    new Date().getFullYear(),
    ...historico.map(item => new Date(item.DataAgendamento).getFullYear())
      .filter(ano => Number.isFinite(ano)),
  ])).sort((a, b) => b - a), [historico]);
  const dadosMensais = useMemo(() => {
    const meses = Array.from({ length: 12 }, (_, mes) => ({
      mes, agendado: 0, concluido: 0, cancelado: 0,
    }));
    for (const item of historico) {
      const data = new Date(item.DataAgendamento);
      if (!Number.isFinite(data.getTime()) || data.getFullYear() !== anoGrafico) continue;
      const status = item.Status?.toUpperCase();
      if (status === "AGENDADO") meses[data.getMonth()].agendado++;
      else if (status === "CONCLUIDO") meses[data.getMonth()].concluido++;
      else if (status === "CANCELADO") meses[data.getMonth()].cancelado++;
    }
    return meses;
  }, [historico, anoGrafico]);
  const valorGrafico = (item: (typeof dadosMensais)[number]) => {
    switch (statusGrafico) {
      case "AGENDADO": return item.agendado;
      case "CONCLUIDO": return item.concluido;
      case "CANCELADO": return item.cancelado;
      default: return item.agendado + item.concluido + item.cancelado;
    }
  };
  const maxGrafico = Math.max(1, ...dadosMensais.map(valorGrafico));
  const totalGrafico = dadosMensais.reduce((total, item) => total + valorGrafico(item), 0);
  const nomesMeses = useMemo(() => Array.from({ length: 12 }, (_, mes) =>
    new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", { month: "short" })
      .format(new Date(2024, mes, 1)).replace(".", "")), [lang]);
  const registrosMes = useMemo(() => mesDetalhe === null ? [] : historico.filter(item => {
    const data = new Date(item.DataAgendamento);
    return Number.isFinite(data.getTime()) && data.getFullYear() === anoGrafico &&
      data.getMonth() === mesDetalhe && (statusGrafico === "TODOS" || item.Status.toUpperCase() === statusGrafico);
  }), [historico, anoGrafico, mesDetalhe, statusGrafico]);
  const gruposServicos = useMemo(() => {
    const grupos = new Map<number, { id: number; nome: string; itens: Agendamento[]; total: number }>();
    for (const item of registrosMes) {
      const grupo = grupos.get(item.ServicoId) ?? { id: item.ServicoId, nome: item.ServicoNome, itens: [], total: 0 };
      grupo.itens.push(item);
      grupo.total += Number(item.ValorServico ?? item.Valor ?? 0) || 0;
      grupos.set(item.ServicoId, grupo);
    }
    return [...grupos.values()].sort((a,b) => b.itens.length - a.itens.length || a.nome.localeCompare(b.nome));
  }, [registrosMes]);
  const grupoAberto = gruposServicos.find(grupo => grupo.id === servicoDetalhe);
  const moeda = (valor: number) => new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", { style: "currency", currency: "BRL" }).format(valor);
  const formatarHorario = (value: string) => {
    const data = new Date(value);
    return Number.isFinite(data.getTime())
      ? new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", { dateStyle: "short", timeStyle: "short" }).format(data)
      : value;
  };
  const nomeStatus = (status: string) => {
    const key = status.toUpperCase();
    if (lang === "pt") return key === "CONCLUIDO" ? "Concluído" : key === "CANCELADO" ? "Cancelado" : key === "AGENDADO" ? "Agendado" : key;
    return key === "CONCLUIDO" ? "Completed" : key === "CANCELADO" ? "Cancelled" : key === "AGENDADO" ? "Scheduled" : key;
  };
  const fecharDetalhes = () => { setMesDetalhe(null); setServicoDetalhe(null); };
  useEffect(() => {
    if (mesDetalhe === null) return;
    const esc = (event: KeyboardEvent) => { if (event.key === "Escape") { if (servicoDetalhe !== null) setServicoDetalhe(null); else setMesDetalhe(null); } };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [mesDetalhe, servicoDetalhe]);
  const cssVars = {
    "--analysis-panel": theme.colors.background2,
    "--analysis-text": theme.colors.text,
    "--analysis-muted": theme.colors.inactive,
    "--analysis-border": theme.colors.bottom,
    "--analysis-primary": theme.colors.primary,
  } as CSSProperties;

  if (!permitido) return <main className={styles.container}>{t("analytics.notAllowed")}</main>;
  return <main className={styles.container} style={cssVars}>
    <section className={styles.chartSection} aria-label={lang === "pt" ? "Agendamentos por mês" : "Appointments by month"}>
      <div className={styles.chartHeading}>
        <div>
          <div className={styles.sectionName}><FaChartLine aria-hidden="true"/><span>{lang === "pt" ? "Agendamentos por mês" : "Appointments by month"}</span></div>
          <p>{lang === "pt" ? "Distribuição mensal por status" : "Monthly distribution by status"}</p>
        </div>
        <div className={styles.chartControls}>
          <label className={styles.yearControl}>
            <span>Status</span>
            <select value={statusGrafico} onChange={event => setStatusGrafico(event.target.value as typeof statusGrafico)}>
              <option value="TODOS">{lang === "pt" ? "Todos" : "All"}</option>
              <option value="AGENDADO">{lang === "pt" ? "Agendados" : "Scheduled"}</option>
              <option value="CONCLUIDO">{lang === "pt" ? "Concluídos" : "Completed"}</option>
              <option value="CANCELADO">{lang === "pt" ? "Cancelados" : "Cancelled"}</option>
            </select>
          </label>
          <label className={styles.yearControl}>
            <span>{lang === "pt" ? "Ano" : "Year"}</span>
            <select value={anoGrafico} onChange={event => setAnoGrafico(Number(event.target.value))}>
              {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className={styles.chartLegend}>
        <strong>{lang === "pt" ? "Total" : "Total"}: {totalGrafico}</strong>
      </div>
      {carregando ? <LoadingState compact label={t("analytics.loading")} /> : erro
        ? <p className={styles.error} role="alert">{erro}</p>
        : <div className={styles.chartPlot}>
          <div className={styles.chartScale} aria-hidden="true">
            {[1,.75,.5,.25,0].map(p => <span key={p}>{Math.ceil(maxGrafico * p)}</span>)}
          </div>
          <div className={styles.chartMonths}>
            {dadosMensais.map((item, index) => {
              const total = valorGrafico(item);
              return <button type="button" className={styles.chartMonth} key={item.mes} onClick={() => { setMesDetalhe(item.mes); setServicoDetalhe(null); }} aria-label={(lang === "pt" ? "Ver detalhes de " : "View details for ") + nomesMeses[index] + " " + anoGrafico + ": " + total}
                title={`${nomesMeses[index]} ${anoGrafico}: ${total} ${statusGrafico === "TODOS" ? "agendamentos" : statusGrafico.toLowerCase()}`}>
                <div className={styles.chartBarTrack}>
                  <div className={`${styles.chartBar} ${statusGrafico === "CONCLUIDO" ? styles.barCompleted : statusGrafico === "CANCELADO" ? styles.barCancelled : statusGrafico === "TODOS" ? styles.barAll : styles.barScheduled}`}
                    style={{ height: `${100 * total / maxGrafico}%` }} />
                  
                </div>
                <span className={styles.chartMonthLabel}>{nomesMeses[index]}</span>
              </button>;
            })}
          </div>
        </div>}
    </section>
    {mesDetalhe !== null && <div className={styles.detailOverlay} onMouseDown={event => { if (event.target === event.currentTarget) fecharDetalhes(); }}>
      <section className={styles.detailDialog} role="dialog" aria-modal="true" aria-labelledby="monthly-detail-title">
        <div className={styles.detailHeading}>
          <div>
            <h2 id="monthly-detail-title">{lang === "pt" ? "Serviços por mês" : "Monthly services"} — {nomesMeses[mesDetalhe]} {anoGrafico}</h2>
            <p>{statusGrafico === "TODOS" ? (lang === "pt" ? "Todos os status" : "All statuses") : nomeStatus(statusGrafico)} · {registrosMes.length} {lang === "pt" ? "agendamentos" : "appointments"}</p>
          </div>
          <button type="button" className={styles.detailClose} onClick={fecharDetalhes} aria-label={lang === "pt" ? "Fechar" : "Close"}><FaTimes /></button>
        </div>
        <div className={styles.detailTotals}>
          <div><span>{lang === "pt" ? "Serviços diferentes" : "Different services"}</span><strong>{gruposServicos.length}</strong></div>
          <div><span>{lang === "pt" ? "Total de agendamentos" : "Total appointments"}</span><strong>{registrosMes.length}</strong></div>
          <div><span>{lang === "pt" ? "Valor dos agendamentos" : "Appointment value"}</span><strong>{moeda(gruposServicos.reduce((total, item) => total + item.total, 0))}</strong></div>
        </div>
        <p className={styles.detailHint}>{lang === "pt" ? "Selecione um serviço para consultar os clientes, horários e valores." : "Select a service to view customers, times and values."}</p>
        <div className={styles.detailList}>
          {gruposServicos.map(grupo => <button className={styles.detailService} type="button" key={grupo.id} onClick={() => setServicoDetalhe(grupo.id)}>
            <span><strong>{grupo.nome || (lang === "pt" ? "Serviço sem nome" : "Unnamed service")}</strong><small>{grupo.itens.length} {lang === "pt" ? "agendamentos" : "appointments"}</small></span>
            <strong>{moeda(grupo.total)}</strong><span aria-hidden="true">›</span>
          </button>)}
          {!gruposServicos.length && <div className={styles.empty}>{lang === "pt" ? "Nenhum agendamento neste período e status." : "No appointments for this month and status."}</div>}
        </div>
      </section>
      {grupoAberto && <div className={styles.detailNestedOverlay} onMouseDown={event => { if (event.target === event.currentTarget) setServicoDetalhe(null); }}>
        <section className={styles.detailDialogLarge} role="dialog" aria-modal="true" aria-labelledby="service-detail-title">
          <div className={styles.detailHeading}>
            <div><h2 id="service-detail-title">{grupoAberto.nome}</h2><p>{grupoAberto.itens.length} {lang === "pt" ? "agendamentos" : "appointments"} · {nomesMeses[mesDetalhe]} {anoGrafico}</p></div>
            <button type="button" className={styles.detailClose} onClick={() => setServicoDetalhe(null)} aria-label={lang === "pt" ? "Voltar" : "Back"}><FaTimes /></button>
          </div>
          <div className={styles.detailTotals}>
            <div><span>{lang === "pt" ? "Agendamentos" : "Appointments"}</span><strong>{grupoAberto.itens.length}</strong></div>
            <div><span>{lang === "pt" ? "Clientes diferentes" : "Unique customers"}</span><strong>{new Set(grupoAberto.itens.map(item => item.ClienteId)).size}</strong></div>
            <div><span>{lang === "pt" ? "Valor dos agendamentos" : "Appointment value"}</span><strong>{moeda(grupoAberto.total)}</strong></div>
          </div>
          <div className={styles.detailTableWrap}><table className={styles.detailTable}><thead><tr>
            <th>{lang === "pt" ? "Cliente" : "Customer"}</th><th>{lang === "pt" ? "Data e horário" : "Date and time"}</th><th>Status</th><th>{lang === "pt" ? "Valor" : "Value"}</th>
          </tr></thead><tbody>{grupoAberto.itens.map(item => <tr key={item.Id}>
            <td>{formatPersonName(item.ClienteNome) || "Cliente #" + item.ClienteId}</td>
            <td>{formatarHorario(item.DataAgendamento)}</td><td>{nomeStatus(item.Status)}</td>
            <td>{moeda(Number(item.ValorServico ?? item.Valor ?? 0) || 0)}</td>
          </tr>)}</tbody></table></div>
          <p className={styles.detailHint}>{lang === "pt" ? "Os valores representam agendamentos registrados, não pagamentos confirmados." : "Values represent recorded appointments, not confirmed payments."}</p>
        </section>
      </div>}
    </div>}
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
      <section className={`${styles.section} ${styles.appointmentHistory}`}>
              <div className={styles.sectionName}>{lang === "pt" ? "Todos os agendamentos" : "All appointments"}</div>
              <p className={styles.historySummary}>
                {lang === "pt"
                  ? `Total: ${historico.length} · Agendados: ${contagens.agendado} · Concluídos: ${contagens.concluido} · Cancelados: ${contagens.cancelado}`
                  : `Total: ${historico.length} · Scheduled: ${contagens.agendado} · Completed: ${contagens.concluido} · Cancelled: ${contagens.cancelado}`}
              </p>
              <div className={styles.historyHeader}>
                <span>{t("analytics.customer")}</span>
                <span>{lang === "pt" ? "Serviço e data" : "Service and date"}</span>
                <span>Status</span>
                <span>{lang === "pt" ? "Motivo do cancelamento" : "Cancellation reason"}</span>
              </div>
              <div className={styles.historyList}>
                {todosAgendamentos.map(item => {
                  const data = new Date(item.DataAgendamento);
                  const status = item.Status.toUpperCase();
                  return <div className={styles.historyItem} key={item.Id}>
                    <strong>{formatPersonName(item.ClienteNome) || `Cliente #${item.ClienteId}`}</strong>
                    <span><strong>{item.ServicoNome}</strong><small>{Number.isFinite(data.getTime())
                      ? new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", { dateStyle: "short", timeStyle: "short" }).format(data)
                      : item.DataAgendamento}</small></span>
                    <span className={styles.historyStatus}>{status === "CONCLUIDO"
                      ? (lang === "pt" ? "Concluído" : "Completed")
                      : status === "CANCELADO" ? (lang === "pt" ? "Cancelado" : "Cancelled")
                      : status === "AGENDADO" ? (lang === "pt" ? "Agendado" : "Scheduled") : status}</span>
                    <span>{status === "CANCELADO"
                      ? item.MotivoCancelamento || (lang === "pt" ? "Motivo não registrado" : "Reason not recorded")
                      : "—"}</span>
                  </div>;
                })}
                {!todosAgendamentos.length && <div className={styles.empty}>
                  {lang === "pt" ? "Nenhum agendamento registrado." : "No appointments recorded."}
                </div>}
              </div>
      </section>

      <section className={`${styles.section} ${styles.marketingSection}`}>
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
