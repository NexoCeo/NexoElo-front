import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { FaBullhorn, FaChartLine, FaClock, FaEnvelope, FaUserClock, FaUsers } from "react-icons/fa";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { listarHistoricoAgendamentos } from "@/services/agendamento-service";
import type { Agendamento } from "@/types/agendamento";
import LoadingState from "@/components/loading-state";
import styles from "./style.module.css";

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
function formatarData(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(data);
}
function agruparClientes(agendamentos: Agendamento[], referencia: Date): ClienteRetencao[] {
  const clientes = new Map<number, { nome: string; ultimaVisita: Date; visitas: number }>();
  for (const agendamento of agendamentos) {
    if (agendamento.ClienteId <= 0 || agendamento.Status.toUpperCase() !== "CONCLUIDO") continue;
    const data = new Date(agendamento.DataAgendamento);
    if (!Number.isFinite(data.getTime()) || data > referencia) continue;
    const anterior = clientes.get(agendamento.ClienteId);
    clientes.set(agendamento.ClienteId, {
      nome: agendamento.ClienteNome || anterior?.nome || "Cliente #" + agendamento.ClienteId,
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
      .catch(() => { if (ativo) setErro("Não foi possível carregar o histórico de atendimentos."); })
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

  if (!permitido) return <main className={styles.container}>Esta área está disponível somente para empresas e autônomos.</main>;
  return <main className={styles.container} style={cssVars}>
    <div className={styles.grid}>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionName}><FaUserClock aria-hidden="true"/><span>Recuperação de clientes</span></div>
          <p>Encontre clientes que já foram atendidos, mas não voltaram recentemente.</p>
        </div>
        <div className={styles.filterRow}>
          <span>Sem retorno há pelo menos</span>
          <div className={styles.filters} role="group" aria-label="Período sem retorno">
            {([30, 60, 90] as const).map(valor =>
              <button key={valor} type="button" className={filtro === valor ? styles.selected : ""}
                aria-pressed={filtro === valor} onClick={() => setFiltro(valor)}>{valor} dias</button>)}
          </div>
        </div>
        {carregando ? <LoadingState label="Analisando histórico de clientes" compact/> : erro
          ? <p className={styles.error} role="alert">{erro}</p>
          : <>
            <div className={styles.metrics}>
              <div className={styles.metric}><FaUsers aria-hidden="true"/><strong>{clientes.length}</strong><span>Clientes com atendimento concluído</span></div>
              <div className={styles.metric}><FaClock aria-hidden="true"/><strong>{inativos.length}</strong><span>Sem retorno há {filtro}+ dias</span></div>
            </div>
            <div className={styles.listHeader}><span>Cliente</span><span>Último atendimento</span><span>Sem retorno</span></div>
            {inativos.length ? <div className={styles.list}>
              {inativos.map(cliente => <div className={styles.client} key={cliente.id}>
                <div className={styles.clientName}><strong>{cliente.nome}</strong><small>{cliente.visitas} atendimento(s) concluído(s)</small></div>
                <span>{formatarData(cliente.ultimaVisita)}</span><strong>{cliente.diasSemVisitar} dias</strong>
              </div>)}
            </div> : <div className={styles.empty}>Nenhum cliente identificado nesse período.</div>}
            <p className={styles.note}>Análise baseada no histórico de atendimentos concluídos disponível no sistema. Clientes sem visita concluída não entram nesta lista.</p>
          </>}
      </section>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionName}><FaChartLine aria-hidden="true"/><span>Automações de marketing</span></div>
          <p>Lembretes, confirmações e campanhas de recuperação de clientes.</p>
        </div>
        <div className={styles.comingSoon}><FaBullhorn aria-hidden="true"/><strong>Em planejamento</strong>
          <span>Recurso desabilitado enquanto avaliamos o custo de envio e um modelo transparente de cobrança.</span>
        </div>
        <div className={styles.automation}><FaEnvelope aria-hidden="true"/><div><strong>Confirmação e lembrete de agendamento</strong>
          <span>Envio automático antes do atendimento.</span></div><span className={styles.disabled}>Indisponível</span></div>
        <div className={styles.automation}><FaUsers aria-hidden="true"/><div><strong>Reativação de clientes</strong>
          <span>Campanhas para quem não retorna há algum tempo.</span></div><span className={styles.disabled}>Indisponível</span></div>
        <p className={styles.note}>Nenhuma mensagem será enviada e nenhuma cobrança adicional será realizada por esta página.</p>
      </section>
    </div>
  </main>;
}
