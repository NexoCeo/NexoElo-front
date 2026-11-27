import { useLocation, useNavigate } from "react-router-dom";
import api from "@/services/api";
import { formatPersonName } from "@/context/UserContext";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { FaBullhorn, FaChartLine, FaEnvelope, FaUsers, FaTimes, FaCalendarAlt, FaDollarSign, FaLayerGroup, FaChevronDown } from "react-icons/fa";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { listarHistoricoAgendamentos } from "@/services/agendamento-service";
import { listarProfissionaisEmpresa } from "@/services/profissional-service";
import type { Profissional } from "@/types/profissional";
import type { Agendamento } from "@/types/agendamento";
import LoadingState from "@/components/loading-state";
import Modal from "@/components/modal";
import { createPortal } from "react-dom";
import styles from "./style.module.css";
import { useLanguage } from "@/context/LanguageContext";
import { usePageRevalidation } from "@/hooks/usePageRevalidation";

export default function AnaliseDados() {
  const { theme } = useTheme();
  const { t, lang } = useLanguage();
  const { usuario } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const tabPaths = { overview:"visao-geral", finance:"financeiro", customers:"clientes", team:"equipe", occupancy:"ocupacao" } as const;
  type MetricTab = keyof typeof tabPaths;
  const metricsBase = location.pathname.split("/metricas")[0] + "/metricas";
  const activeTab: MetricTab = (Object.keys(tabPaths) as MetricTab[]).find(key => location.pathname === `${metricsBase}/${tabPaths[key]}`) ?? "overview";
  const [chartDetail, setChartDetail] = useState<{ kind: "day" | "week"; index: number } | null>(null);
  const interactiveChartsRef = useRef<HTMLDivElement>(null);
  const [teamDetail, setTeamDetail] = useState<{ id:number; completedOnly:boolean } | null>(null);
  const [recurrenceMonths, setRecurrenceMonths] = useState(6);
  const [recurrence, setRecurrence] = useState<{ recurring:number; fresh:number; inactive:number; total:number; recurringPercent:number; freshPercent:number; inactivePercent:number } | null>(null);
  const [recurrenceError, setRecurrenceError] = useState(false);
  const [historico, setHistorico] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [professionalFilter, setProfessionalFilter] = useState("TODOS");
  const [openMetricsFilter, setOpenMetricsFilter] = useState<"periodo" | "profissional" | null>(null);
  const metricsFiltersRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!openMetricsFilter) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!metricsFiltersRef.current?.contains(event.target as Node)) setOpenMetricsFilter(null);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMetricsFilter(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [openMetricsFilter]);
  const [periodFilter, setPeriodFilter] = useState(() => { const today = new Date(); return `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`; });
  useEffect(() => { setChartDetail(null); }, [activeTab, periodFilter, professionalFilter]);
  useEffect(() => {
    if (!chartDetail) return;
    const onOutside = (event: PointerEvent) => {
      if (!interactiveChartsRef.current?.contains(event.target as Node)) setChartDetail(null);
    };
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setChartDetail(null); };
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => { document.removeEventListener("pointerdown", onOutside); document.removeEventListener("keydown", onEscape); };
  }, [chartDetail]);
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

  useEffect(() => {
    if (!usuario?.Id || usuario.Papel !== "EMPRESA") { setProfissionais([]); return; }
    let active = true;
    listarProfissionaisEmpresa(usuario.Id)
      .then(items => { if (active) setProfissionais(items); })
      .catch(() => { if (active) setProfissionais([]); });
    return () => { active = false; };
  }, [usuario?.Id, usuario?.Papel]);

  usePageRevalidation(async () => {
    if (!usuario?.Id || !permitido) return;
    try {
      const history = await listarHistoricoAgendamentos(usuario.Id);
      setHistorico(history);
      setErro("");
      if (usuario.Papel === "EMPRESA") {
        try { setProfissionais(await listarProfissionaisEmpresa(usuario.Id)); } catch { /* retain options */ }
      }
    } catch { /* retain the last good data during temporary network failures */ }
  }, { enabled: Boolean(usuario?.Id) && permitido });

  // O filtro do painel usa registros reais; o restante das análises existentes permanece preservado.
  const metricsHistory = useMemo(() => historico.filter(item => {
    const date = new Date(item.DataAgendamento);
    if (activeTab === "customers") {
      const end = new Date();
      const start = new Date(end);
      const day = start.getDate();
      start.setDate(1);
      start.setMonth(start.getMonth() - recurrenceMonths);
      start.setDate(Math.min(day, new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()));
      return Number.isFinite(date.getTime()) && date >= start && date < end;
    }
    const [year, month] = periodFilter.split("-").map(Number);
    return Number.isFinite(date.getTime()) &&
      date.getFullYear() === year && date.getMonth() + 1 === month &&
      (professionalFilter === "TODOS" || (String(item.ProfissionalId ?? "") === professionalFilter || item.Profissionais?.some(person => String(person.Id) === professionalFilter)));
  }), [historico, periodFilter, professionalFilter, activeTab, recurrenceMonths]);
  const concludedHistory = useMemo(() =>
    metricsHistory.filter(item => item.Status?.toUpperCase() === "CONCLUIDO"), [metricsHistory]);
  const recordedRevenue = concludedHistory.reduce((sum, item) => sum + (Number(item.ValorServico ?? item.Valor ?? 0) || 0), 0);
  const distinctCustomers = new Set(concludedHistory.map(item => item.ClienteId).filter(id => id > 0)).size;
  const averageTicket = concludedHistory.length ? recordedRevenue / concludedHistory.length : 0;
  const referenceMonth = useMemo(() => {
    const [year, month] = periodFilter.split("-").map(Number);
    return { year, month, count: new Date(year, month, 0).getDate() };
  }, [periodFilter]);
  const dailyCounts = useMemo(() => {
    const days = Array.from({ length: referenceMonth.count }, (_, index) => ({ day:index + 1, count:0, revenue:0 }));
    for (const item of metricsHistory) {
      const date = new Date(item.DataAgendamento);
      const entry = days[date.getDate()-1];
      if (!entry) continue;
      entry.count++;
      if (item.Status?.toUpperCase() === "CONCLUIDO") entry.revenue += Number(item.ValorServico ?? item.Valor ?? 0) || 0;
    }
    return days;
  }, [metricsHistory, referenceMonth]);
  const weeklyRevenue = useMemo(() => {
    const weeks = Array.from({length:Math.ceil(referenceMonth.count / 7)}, (_,index) => ({label:`Sem ${index+1}`,value:0}));
    dailyCounts.forEach(item => { weeks[Math.floor((item.day-1)/7)].value += item.revenue; });
    return weeks;
  }, [dailyCounts, referenceMonth]);
  const topServices = useMemo(() => {
    const map = new Map<number,{name:string,count:number}>();
    for (const item of concludedHistory) {
      const old = map.get(item.ServicoId);
      map.set(item.ServicoId,{name:item.ServicoNome || "Serviço",count:(old?.count ?? 0)+1});
    }
    return [...map.values()].sort((a,b)=>b.count-a.count).slice(0,4);
  },[concludedHistory]);
  const latestBookings = useMemo(() => [...metricsHistory]
    .sort((a,b)=>new Date(b.DataAgendamento).getTime()-new Date(a.DataAgendamento).getTime())
    .slice(0,4),[metricsHistory]);
  const dayMaximum = Math.max(1,...dailyCounts.map(item=>item.count));
  const chartPoints = dailyCounts.map((item,index) =>
    `${(index/(Math.max(1,dailyCounts.length-1))*100).toFixed(2)},${(100-(item.count/dayMaximum)*88).toFixed(2)}`).join(" ");
  const maxWeeklyRevenue = Math.max(1,...weeklyRevenue.map(item=>item.value));
  const dashboardMoney = (value:number) => new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US",{style:"currency",currency:"BRL"}).format(value);
  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    for (const item of historico) {
      const date = new Date(item.DataAgendamento);
      if (Number.isNaN(date.getTime())) continue;
      // Todo agendamento conta como movimentação, independentemente do status.
      months.add(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`);
    }
    return [...months].sort((a,b) => b.localeCompare(a)).map(value => {
      const [year, month] = value.split("-").map(Number);
      return {
        value,
        label: new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", {
          month:"long", year:"numeric",
        }).format(new Date(year, month - 1, 1)),
      };
    });
  }, [historico, lang]);
  useEffect(() => {
    if (carregando || !monthOptions.length) return;
    if (!monthOptions.some(option => option.value === periodFilter)) {
      setPeriodFilter(monthOptions[0].value);
    }
  }, [carregando, monthOptions, periodFilter]);

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

  const pt = lang === "pt";
  const tabs = [
    { id: "overview", label: pt ? "Visão geral" : "Overview" },
    { id: "finance", label: pt ? "Financeiro" : "Financial" },
    { id: "customers", label: pt ? "Clientes" : "Customers" },
    ...(usuario?.Papel === "EMPRESA" ? [{ id: "team", label: pt ? "Equipe" : "Team" }] : []),
    { id: "occupancy", label: pt ? "Ocupação" : "Occupancy" },
  ] as { id: typeof activeTab; label: string }[];
  const amount = (item: Agendamento) => Number(item.ValorServico ?? item.Valor ?? 0) || 0;
  const scheduled = metricsHistory.filter(item => item.Status?.toUpperCase() === "AGENDADO");
  const cancelled = metricsHistory.filter(item => item.Status?.toUpperCase() === "CANCELADO");
  const customers = new Map<number, { name: string; count: number; value: number }>();
  for (const item of concludedHistory) {
    if (!(item.ClienteId > 0)) continue;
    const row = customers.get(item.ClienteId) ?? { name: formatPersonName(item.ClienteNome) || "#" + item.ClienteId, count: 0, value: 0 };
    row.count++; row.value += amount(item); customers.set(item.ClienteId, row);
  }
  useEffect(() => {
    if (activeTab !== "customers" || !permitido || !usuario?.Id) return;
    let active = true;
    setRecurrence(null);
    setRecurrenceError(false);
    api.get("/Agendamento/recorrencia-clientes", { params: { meses: recurrenceMonths } })
      .then(({ data }) => {
        if (!active) return;
        const keys = ["recurring","fresh","inactive","total","recurringPercent","freshPercent","inactivePercent"] as const;
        const result = Object.fromEntries(keys.map(key => [key, data[key] ?? data[key[0].toUpperCase()+key.slice(1)]])) as NonNullable<typeof recurrence>;
        if (!keys.every(key => typeof result[key] === "number" && Number.isFinite(result[key]))) { setRecurrenceError(true); return; }
        setRecurrence(result);
      }).catch(() => { if (active) setRecurrenceError(true); });
    return () => { active = false; };
  }, [activeTab, permitido, usuario?.Id, recurrenceMonths]);
  const customerSegments = recurrence ?? { recurring:0, fresh:0, inactive:0, total:0, recurringPercent:0, freshPercent:0, inactivePercent:0 };
  const segmentRows = [
    { label: pt ? "Recorrentes" : "Returning", count: customerSegments.recurring, color: "#22c55e" },
    { label: pt ? "Novos" : "New", count: customerSegments.fresh, color: "#3b82f6" },
    { label: pt ? "Não recorrentes" : "Non-returning", count: customerSegments.inactive, color: "#f59e0b" },
  ];
  const segmentTotal = customerSegments.total;
  const recurringEnd = segmentTotal ? 100 * customerSegments.recurring / segmentTotal : 0;
  const freshEnd = segmentTotal ? 100 * (customerSegments.recurring + customerSegments.fresh) / segmentTotal : 0;
  // Um agendamento pode envolver varios profissionais. Os totais de agendamentos
  // contam IDs unicos; os rankings contam uma participacao por profissional e ID.
  const team = new Map<number, { name: string; count: number; completed: number; appointments: Agendamento[] }>();
  const teamBookings = new Set<number>();
  const teamCompletedBookings = new Set<number>();
  const participationKeys = new Set<string>();
  for (const item of metricsHistory) {
    if (!Number.isInteger(item.Id) || item.Id <= 0) continue;
    const assigned = item.Profissionais?.length ? item.Profissionais : item.ProfissionalId ? [{ Id: item.ProfissionalId, Nome: item.ProfissionalNome }] : [];
    const completed = item.Status?.trim().toUpperCase() === "CONCLUIDO";
    for (const person of new Map(assigned.map(person => [person.Id, person])).values()) {
      if (!Number.isInteger(person.Id) || person.Id <= 0) continue;
      if (professionalFilter !== "TODOS" && String(person.Id) !== professionalFilter) continue;
      const key = `${item.Id}:${person.Id}`;
      if (participationKeys.has(key)) continue;
      participationKeys.add(key);
      teamBookings.add(item.Id);
      if (completed) teamCompletedBookings.add(item.Id);
      const row = team.get(person.Id) ?? { name: formatPersonName(person.Nome) || "#" + person.Id, count: 0, completed: 0, appointments: [] };
      row.count++; if (completed) row.completed++;
      row.appointments.push(item);
      team.set(person.Id, row);
    }
  }
  const selectedTeamMember = teamDetail ? team.get(teamDetail.id) : undefined;
  const selectedTeamAppointments = selectedTeamMember?.appointments.filter(item => !teamDetail?.completedOnly || item.Status?.trim().toUpperCase() === "CONCLUIDO").sort((a,b) => new Date(b.DataAgendamento).getTime() - new Date(a.DataAgendamento).getTime()) ?? [];
  useEffect(() => { setTeamDetail(null); }, [activeTab, periodFilter, professionalFilter, usuario?.Id]);
  const teamParticipationTotal = [...team.values()].reduce((sum, row) => sum + row.count, 0);
  const teamCompletedParticipationTotal = [...team.values()].reduce((sum, row) => sum + row.completed, 0);
  const occupied = metricsHistory.filter(item => ["AGENDADO", "CONCLUIDO"].includes(item.Status?.toUpperCase()));
  const knownDuration = occupied.filter(item => Number(item.DuracaoMinutos) > 0);
  const bookedMinutes = knownDuration.reduce((sum, item) => sum + Number(item.DuracaoMinutos), 0);
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ name: String(hour).padStart(2, "0") + ":00", count: occupied.filter(item => new Date(item.DataAgendamento).getHours() === hour).length })).filter(item => item.count > 0);
  const metric = (label: string, value: string | number, icon = <FaChartLine />) => <div className={styles.dashboardMetric} key={label}><span className={styles.dashboardIcon}>{icon}</span><div><span>{label}</span><strong>{value}</strong></div></div>;
  const ranking = (title: string, rows: { name: string; count: number; display?: string; onSelect?: () => void }[]) => <section className={styles.dashboardPanel}><h2><FaChartLine aria-hidden="true" />{title}</h2><div className={styles.popularList}>{rows.map((row, index) => {
    const content = <><span title={row.name}>{row.name}</span><div className={styles.popularTrack}><span style={{ width: (100 * row.count / Math.max(1, ...rows.map(r => r.count))) + "%" }} /></div><strong>{row.display ?? row.count}</strong></>;
    return row.onSelect ? <button type="button" key={index} className={styles.popularRow} style={{width:"100%",background:"transparent",borderTop:0,borderLeft:0,borderRight:0,color:"inherit",fontFamily:"inherit",textAlign:"left",padding:"0",cursor:"pointer",boxSizing:"border-box"}} aria-label={(pt ? "Ver agendamentos de " : "View appointments for ") + row.name} onClick={row.onSelect}>{content}</button> : <div className={styles.popularRow} key={index}>{content}</div>;
  })}{!rows.length && <p className={styles.dashboardEmpty}>{pt ? "Sem dados no período." : "No data for this period."}</p>}</div></section>;

  if (!permitido) return <main className={styles.container}>{t("analytics.notAllowed")}</main>;
  if (carregando) return <LoadingState label={t("analytics.loading")} variant="metrics" />;
  return <main className={styles.container} style={cssVars}>
    <nav aria-label={pt ? "Categorias de métricas" : "Metric categories"} style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:5,marginBottom:16}}>
      {tabs.map(tab => <button key={tab.id} type="button" aria-pressed={activeTab === tab.id} onClick={() => { navigate(`${metricsBase}/${tabPaths[tab.id]}`); setOpenMetricsFilter(null); }} style={{flex:"0 0 auto",whiteSpace:"nowrap",padding:"11px 18px",font:"inherit",fontWeight:activeTab === tab.id ? 700 : 500,cursor:"pointer",border:0,borderBottom:activeTab === tab.id ? "3px solid var(--analysis-primary)" : "3px solid transparent",borderRadius:"9px 9px 5px 5px",background:activeTab === tab.id ? "var(--theme-primary-soft)" : "transparent",color:activeTab === tab.id ? "var(--theme-primary-text)" : "var(--analysis-muted)"}}>{tab.label}</button>)}
    </nav>
    <header className={styles.dashboardFilters} aria-label="Filtros das métricas" ref={metricsFiltersRef}>
      {activeTab === "customers" ? <div className={styles.topFilter} style={{flex:"1 1 100%",maxWidth:"none"}}>
        <span>{pt ? "Período de recorrência" : "Recurrence period"}</span>
        <button type="button" className={styles.filterInput} aria-label={pt ? "Período de recorrência" : "Recurrence period"} aria-haspopup="listbox" aria-controls="metrics-recurrence-options" aria-expanded={openMetricsFilter === "periodo"} onClick={() => setOpenMetricsFilter(open => open === "periodo" ? null : "periodo")}>
          <FaCalendarAlt aria-hidden="true" />
          <span className={styles.filterValue}>{pt ? "Últimos" : "Last"} {recurrenceMonths} {pt ? "meses" : "months"}</span>
          <FaChevronDown aria-hidden="true" />
        </button>
        {openMetricsFilter === "periodo" && <div id="metrics-recurrence-options" className={styles.filterOptions} role="listbox" aria-label={pt ? "Selecionar período de recorrência" : "Select recurrence period"}>
          {[3,6,12,24].map(months => <button key={months} type="button" role="option" aria-selected={recurrenceMonths === months} className={recurrenceMonths === months ? styles.filterOptionSelected : ""} onClick={() => {if (months !== recurrenceMonths) {setRecurrence(null);setRecurrenceError(false);setRecurrenceMonths(months);}setOpenMetricsFilter(null);}}>
            {pt ? "Últimos" : "Last"} {months} {pt ? "meses" : "months"}{recurrenceMonths === months && <span aria-hidden="true">✓</span>}
          </button>)}
        </div>}
      </div> : <>
      <div className={styles.topFilter}>
        <span>Período</span>
        <button type="button" className={styles.filterInput}
          disabled={carregando || !monthOptions.length}
          aria-label="Período das métricas"
          aria-haspopup="listbox"
          aria-controls="metrics-period-options"
          aria-expanded={openMetricsFilter === "periodo"}
          onClick={() => setOpenMetricsFilter(open => open === "periodo" ? null : "periodo")}>
          <FaCalendarAlt aria-hidden="true" />
          <span className={styles.filterValue}>{monthOptions.find(option => option.value === periodFilter)?.label ?? (carregando ? "Carregando períodos..." : "Sem movimentação")}</span>
          <FaChevronDown aria-hidden="true" />
        </button>
        {openMetricsFilter === "periodo" && (
          <div id="metrics-period-options" className={styles.filterOptions} role="listbox" aria-label="Selecionar período">
            {monthOptions.map(option => (
              <button type="button" role="option" aria-selected={periodFilter === option.value}
                className={periodFilter === option.value ? styles.filterOptionSelected : ""}
                key={option.value}
                onClick={() => { setPeriodFilter(option.value); setOpenMetricsFilter(null); }}>
                {option.label}
                {periodFilter === option.value && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={styles.topFilter}>
        <span>Profissional</span>
        <button type="button" className={styles.filterInput}
          aria-label="Profissional das métricas"
          aria-haspopup="listbox"
          aria-controls="metrics-professional-options"
          aria-expanded={openMetricsFilter === "profissional"}
          onClick={() => setOpenMetricsFilter(open => open === "profissional" ? null : "profissional")}>
          <FaUsers aria-hidden="true" />
          <span className={styles.filterValue}>{professionalFilter === "TODOS" ? "Todos os profissionais" : (profissionais.find(item => String(item.Id) === professionalFilter)?.Nome || "Todos os profissionais")}</span>
          <FaChevronDown aria-hidden="true" />
        </button>
        {openMetricsFilter === "profissional" && (
          <div id="metrics-professional-options" className={styles.filterOptions} role="listbox" aria-label="Selecionar profissional">
            {[{value:"TODOS",label:"Todos os profissionais"}, ...profissionais.map(item => ({value:String(item.Id),label:formatPersonName(item.Nome) || item.Email}))].map(option => (
              <button type="button" role="option" aria-selected={professionalFilter === option.value}
                className={professionalFilter === option.value ? styles.filterOptionSelected : ""}
                key={option.value}
                onClick={() => { setProfessionalFilter(option.value); setOpenMetricsFilter(null); }}>
                {option.label}
                {professionalFilter === option.value && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      </>}
    </header>
    {erro && <p className={styles.error} role="alert">{erro}</p>}
    {activeTab === "finance" && <>
      <section className={styles.dashboardMetrics}>
        {metric(pt ? "Valor concluído" : "Completed value", dashboardMoney(recordedRevenue), <FaDollarSign />)}
        {metric(pt ? "Ticket médio" : "Average ticket", dashboardMoney(averageTicket))}
        {metric(pt ? "Valor agendado" : "Scheduled value", dashboardMoney(scheduled.reduce((sum, item) => sum + amount(item), 0)))}
        {metric(pt ? "Valor cancelado" : "Cancelled value", dashboardMoney(cancelled.reduce((sum, item) => sum + amount(item), 0)))}
      </section>
      <div className={styles.dashboardCharts}>
        {ranking(pt ? "Valor concluído por semana (R$)" : "Completed value by week (BRL)", weeklyRevenue.map(w => ({name:w.label,count:w.value,display:dashboardMoney(w.value)})))}
        <section className={styles.dashboardPanel}><h2><FaDollarSign />{pt ? "Situação dos pagamentos" : "Payment status"}</h2><div className={styles.popularList}>{[...new Set(concludedHistory.map(item => item.StatusPagamento || (pt ? "Não informado" : "Unknown")))].map(status => <div className={styles.detailService} key={status}><span>{status}</span><strong>{concludedHistory.filter(item => (item.StatusPagamento || (pt ? "Não informado" : "Unknown")) === status).length}</strong></div>)}</div><p className={styles.note}>{pt ? "Valores de serviços registrados não equivalem a pagamentos confirmados." : "Recorded service values are not confirmed payments."}</p></section>
      </div>
    </>}
    {activeTab === "customers" && <>
      <section className={styles.dashboardMetrics}>{metric(pt ? "Clientes atendidos" : "Customers served", distinctCustomers, <FaUsers />)}{metric(pt ? "Clientes recorrentes" : "Returning customers", recurrence ? recurrence.recurring : "—")}{metric(pt ? "Atendimentos concluídos" : "Completed appointments", concludedHistory.length)}{metric(pt ? "Valor por cliente" : "Value per customer", dashboardMoney(distinctCustomers ? recordedRevenue / distinctCustomers : 0))}</section>
      <div className={styles.customerLayout}>
      <section className={`${styles.dashboardPanel} ${styles.customerProfile}`} style={{marginBottom:16}}>
        <h2><FaUsers aria-hidden="true"/>{pt ? "Perfil dos clientes" : "Customer profile"}</h2>
        <div aria-busy={!recurrence && !recurrenceError} aria-live="polite">
        <div className={styles.customerProfileChart} style={{display:"grid",gridTemplateColumns:"minmax(0, 1fr) minmax(0, 1.2fr)",alignItems:"center",gap:"clamp(8px, 3vw, 28px)",maxWidth:560,margin:"12px auto 0"}}>
          <div className={styles.customerDonut} role="img" aria-label={recurrence ? segmentRows.map(row => row.label + ": " + row.count).join(", ") : (pt ? "Dados ainda indisponíveis" : "Data not available yet")} style={{position:"relative",width:"100%",maxWidth:190,aspectRatio:"1",justifySelf:"center",borderRadius:"50%",background:!recurrence ? "var(--analysis-border)" : segmentTotal ? `conic-gradient(${segmentRows[0].color} 0% ${recurringEnd}%, ${segmentRows[1].color} ${recurringEnd}% ${freshEnd}%, ${segmentRows[2].color} ${freshEnd}% 100%)` : "var(--analysis-border)"}}>
            <div style={{position:"absolute",inset:"19%",borderRadius:"50%",background:"var(--analysis-panel)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center"}}>
              <strong style={{fontSize:"clamp(20px, 5vw, 32px)",lineHeight:1.1,fontVariantNumeric:"tabular-nums"}}>{recurrence ? segmentTotal : "—"}</strong>
              <span style={{fontSize:11,color:"var(--analysis-muted)"}}>{pt ? "Clientes" : "Customers"}</span>
            </div>
          </div>
          <div style={{display:"grid",gap:12,minWidth:0}}>
            {segmentRows.map(row => <div key={row.label} style={{display:"grid",gridTemplateColumns:"10px minmax(0,1fr) auto",alignItems:"center",gap:7,fontSize:"clamp(10px, 2.9vw, 13px)"}}>
              <span aria-hidden="true" style={{width:10,height:10,borderRadius:"50%",background:row.color}}/>
              <span style={{overflowWrap:"anywhere"}}>{row.label}</span>
              <strong style={{textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{recurrence ? row.count : "—"}<small style={{display:"block",color:"var(--analysis-muted)",fontWeight:400}}>{recurrence ? ([customerSegments.recurringPercent,customerSegments.freshPercent,customerSegments.inactivePercent][segmentRows.indexOf(row)]).toLocaleString(pt ? "pt-BR" : "en-US",{maximumFractionDigits:1})+"%" : "—"}</small></strong>
            </div>)}
          </div>
        </div>
        </div>
        {recurrenceError && <span role="alert" style={{display:"block",fontSize:11,color:"var(--analysis-muted)",marginTop:8}}>{pt ? "Não foi possível consultar a recorrência." : "Could not load recurrence."}</span>}
      </section>
      <div className={`${styles.dashboardCharts} ${styles.customerRankings}`}>{ranking(pt ? "Clientes por atendimentos" : "Customers by appointments", [...customers.values()].sort((a,b) => b.count-a.count))}{ranking(pt ? "Clientes por valor concluído" : "Customers by completed value", [...customers.values()].sort((a,b) => b.value-a.value).map(row => ({name:row.name,count:row.value,display:dashboardMoney(row.value)})))}</div>
      </div>
    </>}
    {activeTab === "team" && <>
      <section className={styles.dashboardMetrics}>
        {metric(pt ? "Profissionais com agendamentos" : "Professionals with bookings", team.size, <FaUsers />)}
        {metric(pt ? "Agendamentos únicos da equipe" : "Unique team bookings", teamBookings.size)}
        {metric(pt ? "Agendamentos únicos concluídos" : "Unique completed bookings", teamCompletedBookings.size)}
      </section>
      <div className={styles.dashboardCharts}>
        {ranking(pt ? "Participações por profissional" : "Bookings per professional", [...team.entries()].sort((a,b) => b[1].count-a[1].count).map(([id,row]) => ({name:row.name,count:row.count,onSelect:()=>setTeamDetail({id,completedOnly:false})})))}
        {ranking(pt ? "Participações em agendamentos concluídos" : "Completed bookings per professional", [...team.entries()].sort((a,b) => b[1].completed-a[1].completed).map(([id,row]) => ({name:row.name,count:row.completed,onSelect:()=>setTeamDetail({id,completedOnly:true})})))}
      </div>
      {teamDetail && selectedTeamMember && createPortal(
        <Modal open={true} title={selectedTeamMember.name} onClose={() => setTeamDetail(null)}>
          <p style={{color:"var(--theme-text-muted)"}}>{teamDetail.completedOnly ? (pt ? "Agendamentos concluídos" : "Completed appointments") : (pt ? "Todos os agendamentos" : "All appointments")} · {new Intl.DateTimeFormat(pt ? "pt-BR" : "en-US",{month:"long",year:"numeric"}).format(new Date(referenceMonth.year,referenceMonth.month-1,1))} · {selectedTeamAppointments.length}</p>
          <div style={{display:"grid",gap:10}}>
            {selectedTeamAppointments.map(item => {
              const services = item.ServicosDetalhados?.filter(service => service.ProfissionalId === teamDetail.id).map(service => service.Nome).filter(Boolean);
              const status = item.Status?.trim().toUpperCase();
              const color = status === "CONCLUIDO" ? "var(--theme-success,#22c55e)" : status === "CANCELADO" ? "var(--theme-error,#ef4444)" : "var(--theme-primary,#3b82f6)";
              return <article key={item.Id} style={{border:"1px solid var(--theme-bottom)",borderRadius:10,padding:12,display:"grid",gap:5,minWidth:0,overflowWrap:"anywhere"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",gap:8,flexWrap:"wrap"}}><strong>{formatPersonName(item.ClienteNome) || "Cliente #" + item.ClienteId}</strong><strong style={{color}}>{nomeStatus(item.Status)}</strong></div>
                <span>{formatarHorario(item.DataAgendamento)}</span>
                <span style={{color:"var(--theme-text-muted)"}}>{services?.length ? services.join(" + ") : item.ServicoNome}</span>
              </article>;
            })}
            {!selectedTeamAppointments.length && <p>{pt ? "Nenhum agendamento neste período." : "No appointments in this period."}</p>}
          </div>
        </Modal>, document.body)}
      <p className={styles.note}>{pt ? `Participações: ${teamParticipationTotal} no total, ${teamCompletedParticipationTotal} em agendamentos concluídos. Um agendamento com mais de um profissional é contado uma vez nos indicadores e uma vez para cada profissional no ranking.` : `Participations: ${teamParticipationTotal} total, ${teamCompletedParticipationTotal} in completed bookings. A booking with multiple professionals counts once in the indicators and once per professional in the rankings.`}</p>
    </>}
    {activeTab === "occupancy" && <>
      <section className={styles.dashboardMetrics}>{metric(pt ? "Agendados e concluídos" : "Scheduled and completed", occupied.length)}{metric(pt ? "Horas reservadas conhecidas" : "Known booked hours", (bookedMinutes/60).toLocaleString(pt ? "pt-BR" : "en-US",{maximumFractionDigits:2})+" h")}{metric(pt ? "Dias com reservas" : "Days with bookings", new Set(occupied.map(item => new Date(item.DataAgendamento).getDate())).size)}{metric(pt ? "Cancelamentos" : "Cancellations", cancelled.length)}</section>
      <div className={styles.dashboardCharts}>{ranking(pt ? "Reservas por horário de início" : "Bookings by start hour", hourly)}{ranking(pt ? "Reservas por dia" : "Bookings by day", dailyCounts.map(day => ({name:String(day.day).padStart(2,"0")+"/"+String(referenceMonth.month).padStart(2,"0"),count:occupied.filter(item => new Date(item.DataAgendamento).getDate() === day.day).length})).filter(day => day.count > 0))}</div>
      <p className={styles.note}>{pt ? "Horas calculadas apenas para reservas com duração informada. A taxa de ocupação exige a capacidade disponível da agenda." : "Hours include bookings with known duration only. Occupancy rate requires available calendar capacity."} ({knownDuration.length}/{occupied.length})</p>
    </>}
    {activeTab === "overview" && <>
    <section className={styles.dashboardMetrics} aria-label="Indicadores do período">
      <div className={styles.dashboardMetric}><span className={styles.dashboardIcon}><FaCalendarAlt /></span><div><span>Agendamentos</span><strong>{metricsHistory.length}</strong></div></div>
      <div className={styles.dashboardMetric}><span className={styles.dashboardIcon}><FaDollarSign /></span><div><span>Valor concluído</span><strong>{dashboardMoney(recordedRevenue)}</strong></div></div>
      <div className={styles.dashboardMetric}><span className={styles.dashboardIcon}><FaUsers /></span><div><span>Clientes atendidos</span><strong>{distinctCustomers}</strong></div></div>
      <div className={styles.dashboardMetric}><span className={styles.dashboardIcon}><FaLayerGroup /></span><div><span>Ticket médio</span><strong>{dashboardMoney(averageTicket)}</strong></div></div>
    </section>
    <div className={styles.dashboardCharts} ref={interactiveChartsRef}>
      <section className={styles.dashboardPanel}>
        <h2><FaCalendarAlt aria-hidden="true" /> Agendamentos no período</h2>
        <div className={styles.lineChart} role="group" aria-label={`Agendamentos diários: ${metricsHistory.length} no mês`}>
          <div className={styles.lineGrid} />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polygon points={`0,100 ${chartPoints} 100,100`} fill="rgba(31,126,243,.18)" />
            <polyline points={chartPoints} fill="none" stroke="#2186ff" strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div style={{position:"absolute",inset:"0 0 22px",display:"flex"}} onPointerLeave={event => {if(event.pointerType === "mouse") setChartDetail(null);}}>
            {dailyCounts.map((day,index) => {
              const selected = chartDetail?.kind === "day" && chartDetail.index === index;
              const x = index / Math.max(1,dailyCounts.length-1) * 100;
              const y = 100 - day.count / dayMaximum * 88;
              const date = new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(referenceMonth.year,referenceMonth.month-1,day.day));
              return <button type="button" key={day.day} aria-label={`${date}: ${day.count} ${pt ? "agendamentos" : "appointments"}`} aria-pressed={selected} style={{position:"absolute",left:`calc(${x}% - ${50/Math.max(1,dailyCounts.length-1)}%)`,width:`${100/Math.max(1,dailyCounts.length-1)}%`,height:"100%",padding:0,border:0,background:"transparent",cursor:"pointer",touchAction:"pan-y",zIndex:selected?2:1}} onPointerEnter={event => {if(event.pointerType === "mouse") setChartDetail({kind:"day",index});}} onFocus={() => setChartDetail({kind:"day",index})} onBlur={() => setChartDetail(current => current?.kind === "day" && current.index === index ? null : current)} onClick={() => setChartDetail({kind:"day",index})}>
                {selected && <span aria-hidden="true" style={{position:"absolute",left:"50%",top:`${y}%`,width:9,height:9,borderRadius:"50%",background:"#2186ff",border:"2px solid var(--analysis-panel)",transform:"translate(-50%,-50%)",pointerEvents:"none"}}/>}
              </button>;
            })}
            {chartDetail?.kind === "day" && dailyCounts[chartDetail.index] && (() => {
              const day = dailyCounts[chartDetail.index];
              const x = chartDetail.index / Math.max(1,dailyCounts.length-1)*100;
              const y = 100-day.count/dayMaximum*88;
              return <div role="tooltip" style={{position:"absolute",left:`${x}%`,top:`${y}%`,transform:`translate(${x<24?"0":x>76?"-100%":"-50%"},${y<45?"12px":"calc(-100% - 12px)"})`,padding:"8px 11px",border:"1px solid var(--analysis-border)",borderRadius:8,background:"var(--analysis-panel)",color:"var(--analysis-text)",boxShadow:"0 4px 16px #0005",fontSize:11,whiteSpace:"nowrap",pointerEvents:"none",zIndex:4}}>
                <strong>{String(day.day).padStart(2,"0")}/{String(referenceMonth.month).padStart(2,"0")}/{referenceMonth.year}</strong><div>{pt ? "Agendamentos" : "Appointments"}: {day.count}</div><div>{pt ? "Valor concluído" : "Completed value"}: {dashboardMoney(day.revenue)}</div>
              </div>;
            })()}
          </div>
          <div className={styles.lineLabels}><span>01/{String(referenceMonth.month).padStart(2,"0")}</span><span>{String(Math.ceil(referenceMonth.count/2)).padStart(2,"0")}/{String(referenceMonth.month).padStart(2,"0")}</span><span>{referenceMonth.count}/{String(referenceMonth.month).padStart(2,"0")}</span></div>
        </div>
      </section>
      <section className={styles.dashboardPanel}>
        <div className={styles.revenueTitle}><h2><FaDollarSign aria-hidden="true" /> Valor concluído por semana</h2><strong>{dashboardMoney(recordedRevenue)}</strong></div>
        <div className={styles.weekChart} role="group" aria-label={`Valores dos agendamentos concluídos por semana: ${dashboardMoney(recordedRevenue)} no mês`}>
          {weeklyRevenue.map((week,index) => {
            const selected = chartDetail?.kind === "week" && chartDetail.index === index;
            const first = index*7+1;
            const last = Math.min(first+6, referenceMonth.count);
            const month = String(referenceMonth.month).padStart(2,"0");
            const range = `${String(first).padStart(2,"0")}/${month} – ${String(last).padStart(2,"0")}/${month}`;
            return <div className={styles.weekBarColumn} key={week.label} style={{position:"relative"}} onPointerLeave={event => {if(event.pointerType === "mouse") setChartDetail(current => current?.kind === "week" ? null : current);}}>
              <button type="button" className={styles.weekBarTrack} aria-label={`${range}: ${dashboardMoney(week.value)}`} aria-pressed={selected} style={{padding:0,borderTop:0,borderLeft:0,borderRight:0,cursor:"pointer",touchAction:"pan-y"}} onPointerEnter={event => {if(event.pointerType === "mouse") setChartDetail({kind:"week",index});}} onFocus={() => setChartDetail({kind:"week",index})} onBlur={() => setChartDetail(current => current?.kind === "week" && current.index === index ? null : current)} onClick={() => setChartDetail({kind:"week",index})}><span className={styles.weekBar} style={{display:"block",height:`${Math.max(week.value>0?2:0,(week.value/maxWeeklyRevenue)*100)}%`}}/></button>
              <span>{week.label}</span>
              {selected && <div role="tooltip" style={{position:"absolute",top:0,left:index===0?"0":index===weeklyRevenue.length-1?"auto":"50%",right:index===weeklyRevenue.length-1?0:"auto",transform:index===0||index===weeklyRevenue.length-1?"none":"translateX(-50%)",padding:"8px 11px",border:"1px solid var(--analysis-border)",borderRadius:8,background:"var(--analysis-panel)",color:"var(--analysis-text)",boxShadow:"0 4px 16px #0005",fontSize:11,whiteSpace:"nowrap",pointerEvents:"none",zIndex:4}}><strong>{range}</strong><div>{pt ? "Valor concluído" : "Completed value"}: {dashboardMoney(week.value)}</div></div>}
            </div>;
          })}
        </div>
      </section>
    </div>
    <div className={styles.dashboardBottom}>
      <section className={styles.dashboardPanel}>
        <h2><FaLayerGroup aria-hidden="true"/> Serviços mais procurados</h2>
        <div className={styles.popularList}>
          {topServices.map((item,index)=><div className={styles.popularRow} key={index}><span>{item.name}</span><div className={styles.popularTrack}><span style={{width:`${100*item.count/Math.max(1,topServices[0]?.count ?? 1)}%`}}/></div><strong>{item.count}</strong></div>)}
          {!topServices.length && <p className={styles.dashboardEmpty}>Nenhum serviço concluído no período.</p>}
        </div>
      </section>
      <section className={styles.dashboardPanel}>
        <div className={styles.latestTitle}><h2><FaCalendarAlt aria-hidden="true"/> Últimos agendamentos</h2></div>
        <div className={styles.latestList}>
          {latestBookings.map(item=><div className={`${styles.latestRow} ${item.Status?.toUpperCase() === "CONCLUIDO" ? styles.latestCompleted : item.Status?.toUpperCase() === "CANCELADO" ? styles.latestCancelled : styles.latestOther}`} key={item.Id}>
            <time>{new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(item.DataAgendamento))}</time>
            <strong>{formatPersonName(item.ClienteNome) || `Cliente #${item.ClienteId}`}</strong>
            <span>{item.ServicoNome}</span>
            <em>{dashboardMoney(Number(item.ValorServico ?? item.Valor ?? 0) || 0)}</em>
            <small>{nomeStatus(item.Status)}</small>
          </div>)}
          {!latestBookings.length && <p className={styles.dashboardEmpty}>Nenhum agendamento no período.</p>}
        </div>
      </section>
    </div>
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
              const registrosBarra = historico.filter(registro => {
                const data = new Date(registro.DataAgendamento);
                return Number.isFinite(data.getTime()) && data.getFullYear() === anoGrafico &&
                  data.getMonth() === item.mes && (statusGrafico === "TODOS" || registro.Status.toUpperCase() === statusGrafico);
              });
              const valorBarra = registrosBarra.reduce((valor, registro) => valor + (Number(registro.ValorServico ?? registro.Valor ?? 0) || 0), 0);
              return <button type="button" className={styles.chartMonth} key={item.mes} onClick={() => { setMesDetalhe(item.mes); setServicoDetalhe(null); }} aria-label={(lang === "pt" ? "Ver detalhes de " : "View details for ") + nomesMeses[index] + " " + anoGrafico + ": " + total}
                >
                <div className={styles.chartBarTrack}>
                  <div className={`${styles.chartBar} ${statusGrafico === "CONCLUIDO" ? styles.barCompleted : statusGrafico === "CANCELADO" ? styles.barCancelled : statusGrafico === "TODOS" ? styles.barAll : styles.barScheduled}`}
                    style={{ height: `${100 * total / maxGrafico}%` }} />
                  {total > 0 && <span className={styles.chartBarTooltip} style={{bottom:`calc(${100 * total / maxGrafico}% + 7px)`}} aria-hidden="true">
                    <strong>{lang === "pt" ? "Valor" : "Value"}: {moeda(valorBarra)}</strong>
                    <small>{total} {lang === "pt" ? "agendamentos" : "appointments"} · {statusGrafico === "TODOS" ? (lang === "pt" ? "Todos" : "All") : nomeStatus(statusGrafico)}</small>
                    <small>{nomesMeses[index]} {anoGrafico}</small>
                  </span>}
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
            <button type="button" className={`${styles.detailClose} ${styles.detailBack}`} onClick={() => setServicoDetalhe(null)}>{lang === "pt" ? "Voltar" : "Back"}</button>
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
    </>}
  </main>;
}
