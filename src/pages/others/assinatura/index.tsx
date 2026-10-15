import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { FaCheck, FaTimes } from "react-icons/fa";
import { useUser } from "@/context/UserContext";
import { useNotification } from "@/context/NotificationContext";
import { consultarAssinatura, iniciarCheckout, alterarPlano, atualizarRecursosAtivos, listarRecursosPlano, abrirPortal, planos, type AssinaturaAtual, type RecursoPlano } from "@/services/assinatura-service";
import styles from "./style.module.css";
import Modal from "@/components/modal";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const nomes: Record<string,string> = { GRATIS: "Grátis", BASICO: "Básico", INTERMEDIARIO: "Intermediário", AVANCADO: "Avançado", SEM_PLANO: "Sem plano" };

export default function MinhaAssinatura() {
  const { usuario } = useUser();
  const { showNotification } = useNotification();
  const [assinatura, setAssinatura] = useState<AssinaturaAtual | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState("");
  const [destino, setDestino] = useState<"BASICO" | "INTERMEDIARIO" | "AVANCADO" | null>(null);
  const [recursos, setRecursos] = useState<RecursoPlano[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [carregandoRecursos, setCarregandoRecursos] = useState(false);
  const [editandoRecursos, setEditandoRecursos] = useState(false);
  const [confirmacao, setConfirmacao] = useState<{ plano: "BASICO" | "INTERMEDIARIO" | "AVANCADO"; servicos?: number[]; profissionais?: number[] } | null>(null);

  useEffect(() => {
    let active = true;
    consultarAssinatura()
      .then(data => { if (active) setAssinatura(data); })
      .catch(() => { if (active) showNotification({ type: "error", title: "Assinatura", message: "Não foi possível carregar sua assinatura." }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showNotification]);

  async function executar(chave: string, acao: () => Promise<void>) {
    setPending(chave);
    try { await acao(); }
    catch (error) {
      const response = isAxiosError<{ Erro?: string; erro?: string; message?: string }>(error)
        ? error.response?.data : undefined;
      const message = response?.Erro || response?.erro || response?.message ||
        "Não foi possível abrir a cobrança. Tente novamente.";
      showNotification({ type: "error", title: "Assinatura", message });
    } finally { setPending(""); }
  }

  async function selecionarPlano(plano: "BASICO" | "INTERMEDIARIO" | "AVANCADO") {
    if (!usuario?.Id || !assinatura) return;
    const jaAssinante = assinatura.AcessoAtivo &&
      (assinatura.Plano === "BASICO" || assinatura.Plano === "INTERMEDIARIO" || assinatura.Plano === "AVANCADO");
    if (!jaAssinante) {
      await executar(plano, () => iniciarCheckout(usuario.Id, plano));
      return;
    }
    setCarregandoRecursos(true);
    try {
      const itens = await listarRecursosPlano();
      const limites = plano === "BASICO" ? [4, 2] : plano === "INTERMEDIARIO" ? [8, 4] : [Infinity, Infinity];
      const servicos = itens.filter(i => i.Tipo === "SERVICO");
      const profissionais = itens.filter(i => i.Tipo === "PROFISSIONAL");
      const excede = servicos.length > limites[0] || profissionais.length > limites[1];
      if (excede) {
        setRecursos(itens);
        setSelecionados([
          ...servicos.slice(0, limites[0]).map(x=>`${x.Tipo}:${x.Id}`),
          ...profissionais.slice(0, limites[1]).map(x=>`${x.Tipo}:${x.Id}`)
        ]);
        setDestino(plano);
      } else {
        await confirmarTroca(plano, undefined, undefined);
      }
    } catch {
      showNotification({ type: "error", title: "Assinatura", message: "Não foi possível carregar os serviços e profissionais." });
    } finally { setCarregandoRecursos(false); }
  }

  async function confirmarTroca(plano: "BASICO" | "INTERMEDIARIO" | "AVANCADO", servicos?: number[], profissionais?: number[]) {
    if (!usuario?.Id) return;
    if (editandoRecursos) {
      await executar("recursos", async () => {
        await atualizarRecursosAtivos(usuario.Id, plano, servicos, profissionais);
        setDestino(null);
        setEditandoRecursos(false);
        showNotification({ type: "success", title: "Recursos atualizados", message: "Sua seleção de recursos ativos foi salva." });
      });
      return;
    }
    setConfirmacao({ plano, servicos, profissionais });
  }

  async function aplicarTroca() {
    if (!confirmacao || !usuario?.Id) return;
    const { plano, servicos, profissionais } = confirmacao;
    await executar(plano, async () => {
      await alterarPlano(usuario.Id, plano, servicos, profissionais, assinatura?.Status === "CANCELAMENTO_PENDENTE");
      setAssinatura(await consultarAssinatura());
      setDestino(null);
      setConfirmacao(null);
      setEditandoRecursos(false);
      showNotification({ type: "success", title: "Plano alterado", message: "Recursos atualizados. Próxima renovação com o novo preço." });
    });
  }

  async function editarSelecao() {
    if (!assinatura || assinatura.Plano === "GRATIS" || assinatura.Plano === "SEM_PLANO") return;
    setCarregandoRecursos(true);
    try {
      const itens = await listarRecursosPlano();
      const limites = assinatura.Plano === "BASICO" ? [4,2] : assinatura.Plano === "INTERMEDIARIO" ? [8,4] : [Infinity,Infinity];
      setRecursos(itens);
      setSelecionados([
        ...itens.filter(x=>x.Tipo==="SERVICO" && x.Ativo).slice(0,limites[0]).map(x=>`${x.Tipo}:${x.Id}`),
        ...itens.filter(x=>x.Tipo==="PROFISSIONAL" && x.Ativo).slice(0,limites[1]).map(x=>`${x.Tipo}:${x.Id}`)
      ]);
      setEditandoRecursos(true);
      setDestino(assinatura.Plano);
    } catch {
      showNotification({ type: "error", title: "Assinatura", message: "Não foi possível carregar os recursos." });
    } finally { setCarregandoRecursos(false); }
  }

  function alternarRecurso(id: string) {
    setSelecionados(prev=>prev.includes(id)?prev.filter(i=>i!==id):[...prev,id]);
  }

  const limite = (valor: number) => valor === 2147483647 ? "Ilimitados" : String(valor);
  return (
    <main className={styles.page}>
      <div className={styles.heading}>
        <div>
          <h1 className={styles.title}>Minha assinatura</h1>
          <p className={styles.subtitle}>Gerencie seu plano e escolha os recursos ideais para seu negócio.</p>
        </div>
      </div>

      {loading ? <section className={styles.status}>Carregando assinatura...</section> : assinatura && (
        <section className={styles.status} aria-label="Plano atual">
          <div>
            <h2 className={styles.statusTitle}>Plano atual: {nomes[assinatura.Plano] ?? assinatura.Plano}</h2>
            <div className={styles.statusMeta}>
              <span className={assinatura.AcessoAtivo ? styles.active : styles.inactive}>
                {assinatura.AcessoAtivo ? "● Acesso ativo" : "● Acesso suspenso"}
              </span>
              {assinatura.DataFim && <span>Válido até {new Date(assinatura.DataFim).toLocaleDateString("pt-BR")}</span>}
              <span>Serviços: {assinatura.ServicosCadastrados} / {limite(assinatura.LimiteServicos)}</span>
              {usuario?.Papel === "EMPRESA" && <span>Profissionais: {assinatura.ProfissionaisVinculados} / {limite(assinatura.LimiteProfissionais)}</span>}
            </div>
            {assinatura.ServicosCadastrados > assinatura.LimiteServicos && <p className={styles.note}>Existem serviços acima do limite do plano atual.</p>}
            {usuario?.Papel === "EMPRESA" && assinatura.ProfissionaisVinculados > assinatura.LimiteProfissionais && <p className={styles.note}>Existem vínculos profissionais acima do limite do plano atual.</p>}
          </div>
          {assinatura.AcessoAtivo && (assinatura.Plano === "BASICO" || assinatura.Plano === "INTERMEDIARIO") &&
            (assinatura.ServicosCadastrados > assinatura.LimiteServicos ||
              (usuario?.Papel === "EMPRESA" && assinatura.ProfissionaisVinculados > assinatura.LimiteProfissionais)) && (
            <button className={styles.secondaryButton} type="button" onClick={()=>void editarSelecao()} disabled={Boolean(pending)||carregandoRecursos}>
              Gerenciar recursos ativos
            </button>
          )}
          {(assinatura.Plano === "BASICO" || assinatura.Plano === "INTERMEDIARIO" || assinatura.Plano === "AVANCADO") && (
            <button className={styles.secondaryButton} type="button" disabled={Boolean(pending)}
              onClick={() => usuario?.Id && executar("portal", () => abrirPortal(usuario.Id))}>
              Gerenciar pagamento
            </button>
          )}
        </section>
      )}

      <h2 className={styles.sectionTitle}>Escolha seu plano</h2>
      <section className={styles.grid} aria-label="Planos disponíveis">
        {planos.map(plano => {
          const atual = assinatura?.Plano === plano.id;
          return (
            <article key={plano.id} className={`${styles.card} ${plano.id === "INTERMEDIARIO" ? styles.featured : ""}`}>
              <div className={styles.cardTop}>
                <h3 className={styles.cardName}>{plano.nome}</h3>
                {atual ? <span className={styles.tag}>Plano atual</span> : plano.id === "INTERMEDIARIO" ? <span className={styles.tag}>Mais popular</span> : null}
              </div>
              <p className={styles.price}>{reais.format(plano.valor)} <small>/mês</small></p>
              <p className={styles.description}>
                {plano.id === "BASICO" ? "Para começar a organizar seus atendimentos." :
                 plano.id === "INTERMEDIARIO" ? "Mais capacidade e relatórios para crescer." :
                 "Liberdade para expandir sua operação."}
              </p>
              <ul className={styles.features}>
                <li className={styles.feature}><FaCheck className={styles.featureIcon} aria-hidden="true" /> {plano.servicos}</li>
                <li className={styles.feature}><FaCheck className={styles.featureIcon} aria-hidden="true" /> {plano.profissionais}</li>
                <li className={styles.feature}>
                  {plano.relatorios ? <FaCheck className={styles.featureIcon} aria-hidden="true" /> : <FaTimes className={styles.off} aria-hidden="true" />}
                  <span className={plano.relatorios ? "" : styles.off}>{plano.relatorios ? "Relatórios PDF incluídos" : "Sem relatórios PDF"}</span>
                </li>
                <li className={styles.feature}><FaCheck className={styles.featureIcon} aria-hidden="true" /> Agenda e gestão de serviços</li>
              </ul>
              <button className={styles.button} type="button"
                disabled={loading || carregandoRecursos || Boolean(pending) || !usuario?.Id || atual || !assinatura}
                onClick={() => void selecionarPlano(plano.id)}>
                {atual ? "Seu plano atual" : pending === plano.id ? "Processando..." :
                 assinatura?.AcessoAtivo && assinatura.Plano !== "GRATIS" && assinatura.Plano !== "SEM_PLANO" ? "Alterar plano" : "Selecionar plano"}
              </button>
            </article>
          );
        })}
      </section>
      {destino && (() => {
        const limiteServicos = destino === "BASICO" ? 4 : destino === "INTERMEDIARIO" ? 8 : Infinity;
        const limiteProfissionais = destino === "BASICO" ? 2 : destino === "INTERMEDIARIO" ? 4 : Infinity;
        const servicos = recursos.filter(item => item.Tipo === "SERVICO");
        const profissionais = recursos.filter(item => item.Tipo === "PROFISSIONAL");
        const ids = (itens: RecursoPlano[]) => itens.filter(x=>selecionados.includes(`${x.Tipo}:${x.Id}`)).map(x=>x.Id);
        const validos = (servicos.length <= limiteServicos || ids(servicos).length === limiteServicos) &&
          (profissionais.length <= limiteProfissionais || ids(profissionais).length === limiteProfissionais);
        return <Modal open title="Escolha os recursos que continuarão ativos"
          onClose={()=>{setDestino(null);setEditandoRecursos(false);}} busy={Boolean(pending)}
          actions={<>
            <button type="button" className={styles.secondaryButton} disabled={Boolean(pending)}
              onClick={()=>{setDestino(null);setEditandoRecursos(false);}}>Cancelar</button>
            <button type="button" className={styles.button} disabled={!validos || Boolean(pending)}
              onClick={()=>void confirmarTroca(destino,
                servicos.length > limiteServicos ? ids(servicos) : undefined,
                profissionais.length > limiteProfissionais ? ids(profissionais) : undefined)}>
              {editandoRecursos ? "Salvar recursos ativos" : "Continuar"}
            </button>
          </>}>
          <p>Os recursos não selecionados ficarão indisponíveis para novos agendamentos. Dados e histórico serão preservados.</p>
          {([["SERVICO",servicos,limiteServicos],["PROFISSIONAL",profissionais,limiteProfissionais]] as const).map(([tipo,itens,limite]) =>
            itens.length > limite && <fieldset key={tipo} className={styles.selectionGroup}>
              <legend>{tipo === "SERVICO" ? "Serviços" : "Profissionais"} — selecione {limite} de {itens.length}</legend>
              {itens.map(item=><label key={item.Id} className={styles.resource}>
                <input type="checkbox" checked={selecionados.includes(`${item.Tipo}:${item.Id}`)}
                  onChange={()=>alternarRecurso(`${item.Tipo}:${item.Id}`)} />
                {item.Nome}
              </label>)}
            </fieldset>)}
        </Modal>;
      })()}
      <Modal open={Boolean(confirmacao)} title="Confirmar alteração do plano"
        onClose={()=>setConfirmacao(null)} busy={Boolean(pending)}
        actions={<>
          <button type="button" className={styles.secondaryButton} disabled={Boolean(pending)} onClick={()=>setConfirmacao(null)}>Cancelar</button>
          <button type="button" className={styles.button} disabled={Boolean(pending)} onClick={()=>void aplicarTroca()}>
            {pending ? "Alterando..." : "Confirmar alteração"}
          </button>
        </>}>
        <p>Alterar para <strong>{planos.find(item=>item.id===confirmacao?.plano)?.nome}</strong> por <strong>{reais.format(planos.find(item=>item.id===confirmacao?.plano)?.valor ?? 0)}/mês</strong>?</p>
        {assinatura?.Status === "CANCELAMENTO_PENDENTE" && <p><strong>Renovação:</strong> esta confirmação também desfaz o cancelamento programado e reativa a cobrança recorrente do novo plano.</p>}
        <p>O novo valor será cobrado na próxima renovação. Os recursos não selecionados ficarão indisponíveis para novos agendamentos, mas os dados e o histórico serão preservados.</p>
      </Modal>
      <p className={styles.note}>O plano Grátis oferece 30 dias com acesso completo. Em mudanças de plano, seus dados são preservados; recursos excedentes precisam ser regularizados.</p>
    </main>
  );
}
