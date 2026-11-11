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
import styles from "./style.module.css";
import { useLanguage } from "@/context/LanguageContext";

export default function AnaliseDados() {
  const { theme } = useTheme();
  const { t, lang } = useLanguage();
  const { usuario } = useUser();
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

  // O filtro do painel usa registros reais; o restante das análises existentes permanece preservado.
  const metricsHistory = useMemo(() => historico.filter(item => {
    const date = new Date(item.DataAgendamento);
    const [year, month] = periodFilter.split("-").map(Number);
    return Number.isFinite(date.getTime()) &&
      date.getFullYear() === year && date.getMonth() + 1 === month &&
      (professionalFilter === "TODOS" || String(item.ProfissionalId ?? "") === professionalFilter);
  }), [historico, periodFilter, professionalFilter]);
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

  if (!permitido) return <main className={styles.container}>{t("analytics.notAllowed")}</main>;
  return <main className={styles.container} style={cssVars}>
    <header className={styles.dashboardFilters} aria-label="Filtros das métricas" ref={metricsFiltersRef}>
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
    </header>
    {erro && <p className={styles.error} role="alert">{erro}</p>}
    <section className={styles.dashboardMetrics} aria-label="Indicadores do período">
      <div className={styles.dashboardMetric}><span className={styles.dashboardIcon}><FaCalendarAlt /></span><div><span>Agendamentos</span><strong>{metricsHistory.length}</strong></div></div>
      <div className={styles.dashboardMetric}><span className={styles.dashboardIcon}><FaDollarSign /></span><div><span>Valor concluído</span><strong>{dashboardMoney(recordedRevenue)}</strong></div></div>
      <div className={styles.dashboardMetric}><span className={styles.dashboardIcon}><FaUsers /></span><div><span>Clientes atendidos</span><strong>{distinctCustomers}</strong></div></div>
      <div className={styles.dashboardMetric}><span className={styles.dashboardIcon}><FaLayerGroup /></span><div><span>Ticket médio</span><strong>{dashboardMoney(averageTicket)}</strong></div></div>
    </section>
    <div className={styles.dashboardCharts}>
      <section className={styles.dashboardPanel}>
        <h2><FaCalendarAlt aria-hidden="true" /> Agendamentos no período</h2>
        <div className={styles.lineChart} role="img" aria-label={`Agendamentos diários: ${metricsHistory.length} no mês`}>
          <div className={styles.lineGrid} />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polygon points={`0,100 ${chartPoints} 100,100`} fill="rgba(31,126,243,.18)" />
            <polyline points={chartPoints} fill="none" stroke="#2186ff" strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div className={styles.lineLabels}><span>01/{String(referenceMonth.month).padStart(2,"0")}</span><span>{String(Math.ceil(referenceMonth.count/2)).padStart(2,"0")}/{String(referenceMonth.month).padStart(2,"0")}</span><span>{referenceMonth.count}/{String(referenceMonth.month).padStart(2,"0")}</span></div>
        </div>
      </section>
      <section className={styles.dashboardPanel}>
        <div className={styles.revenueTitle}><h2><FaDollarSign aria-hidden="true" /> Valor concluído por semana</h2><strong>{dashboardMoney(recordedRevenue)}</strong></div>
        <div className={styles.weekChart} role="img" aria-label={`Valores dos agendamentos concluídos por semana: ${dashboardMoney(recordedRevenue)} no mês`}>
          {weeklyRevenue.map(week => <div className={styles.weekBarColumn} key={week.label}>
            <div className={styles.weekBarTrack}><div className={styles.weekBar} style={{height:`${Math.max(week.value>0?2:0,(week.value/maxWeeklyRevenue)*100)}%`}} title={dashboardMoney(week.value)}/></div>
            <span>{week.label}</span>
          </div>)}
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
          {latestBookings.map(item=><div className={styles.latestRow} key={item.Id}>
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
    <div className={styles.grid}>
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
