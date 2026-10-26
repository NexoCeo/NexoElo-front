import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaCheck, FaTimes } from "react-icons/fa";
import { useUser } from "@/context/UserContext";
import { useNotification } from "@/context/NotificationContext";
import { consultarAssinatura, iniciarCheckout, alterarPlano, atualizarRecursosAtivos, listarRecursosPlano, abrirPortal, planos, type AssinaturaAtual, type RecursoPlano } from "@/services/assinatura-service";
import styles from "./style.module.css";
import Modal from "@/components/modal";
import LoadingState from "@/components/loading-state";
import { useLanguage } from "@/context/LanguageContext";


export default function MinhaAssinatura({ publicView = false }: { publicView?: boolean }) {
  const navigate = useNavigate();
  const { usuario } = useUser();
  const { lang, t } = useLanguage();
  const reais = new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", { style: "currency", currency: "BRL" });
  const nomes: Record<string,string> = { GRATIS:t("subscription.free"), BASICO:t("subscription.basic"), INTERMEDIARIO:t("subscription.intermediate"), AVANCADO:t("subscription.advanced"), SEM_PLANO:t("subscription.noPlan") };
  const { showNotification } = useNotification();
  const texto = (pt: string, en: string) => lang === "pt" ? pt : en;
  const [assinatura, setAssinatura] = useState<AssinaturaAtual | null>(null);
  const [loading, setLoading] = useState(true);
  const [mostrarPlanos] = useState(publicView);
  const [pending, setPending] = useState("");
  const [destino, setDestino] = useState<"BASICO" | "INTERMEDIARIO" | "AVANCADO" | null>(null);
  const [recursos, setRecursos] = useState<RecursoPlano[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [carregandoRecursos, setCarregandoRecursos] = useState(false);
  const [editandoRecursos, setEditandoRecursos] = useState(false);
  const [confirmacao, setConfirmacao] = useState<{ plano: "BASICO" | "INTERMEDIARIO" | "AVANCADO"; servicos?: number[]; profissionais?: number[] } | null>(null);

  useEffect(() => {
    let active = true;
    if (publicView && !usuario?.Id) { setLoading(false); return; }
    consultarAssinatura()
      .then(data => { if (active) setAssinatura(data); })
      .catch(() => { if (active) showNotification({ type: "error", title: t("subscription.title"), message: t("subscription.failedLoad") }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showNotification, publicView, usuario?.Id]);

  async function executar(chave: string, acao: () => Promise<void>) {
    setPending(chave);
    try { await acao(); }
    catch (error) {
      const response = isAxiosError<{ Erro?: string; erro?: string; message?: string }>(error)
        ? error.response?.data : undefined;
      const message = response?.Erro || response?.erro || response?.message ||
        t("subscription.errorOpen");
      showNotification({ type: "error", title: t("subscription.title"), message });
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
      showNotification({ type: "error", title: t("subscription.title"), message: t("subscription.errorResources") });
    } finally { setCarregandoRecursos(false); }
  }

  async function confirmarTroca(plano: "BASICO" | "INTERMEDIARIO" | "AVANCADO", servicos?: number[], profissionais?: number[]) {
    if (!usuario?.Id) return;
    if (editandoRecursos) {
      await executar("recursos", async () => {
        await atualizarRecursosAtivos(usuario.Id, plano, servicos, profissionais);
        setDestino(null);
        setEditandoRecursos(false);
        showNotification({ type: "success", title: t("subscription.resourcesUpdated"), message: t("subscription.resourcesSaved") });
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
      showNotification({ type: "success", title: t("subscription.planChanged"), message: t("subscription.nextPrice") });
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
      showNotification({ type: "error", title: t("subscription.title"), message: t("subscription.loadResources") });
    } finally { setCarregandoRecursos(false); }
  }

  function alternarRecurso(id: string) {
    setSelecionados(prev=>prev.includes(id)?prev.filter(i=>i!==id):[...prev,id]);
  }

  return (
    <main className={styles.page}>
      {!publicView && <section className={styles.management} aria-label={texto("Gerenciamento da assinatura", "Subscription management")}>
        <div className={styles.managementHeading}>
          <div>
            <h2 className={styles.sectionTitle}>{texto("Gerenciar assinatura", "Manage subscription")}</h2>
            <p className={styles.description}>{texto("Acompanhe seu acesso e gerencie o plano da sua conta.", "Review your access and manage your account plan.")}</p>
          </div>
          <div className={styles.managementActions}>
            {(assinatura?.Plano === "BASICO" || assinatura?.Plano === "INTERMEDIARIO" || assinatura?.Plano === "AVANCADO") && (
              <button className={styles.secondaryButton} type="button" disabled={Boolean(pending)}
                onClick={() => usuario?.Id && executar("portal", () => abrirPortal(usuario.Id))}>
                {texto("Gerenciar pagamentos", "Manage payments")}
              </button>
            )}
            <button type="button" className={styles.viewPlansButton} onClick={() => navigate("/planos")}>
              {texto("Ver planos", "View plans")}
            </button>
          </div>
        </div>
        <div className={styles.managementStats}>
          <div className={styles.managementStat}>
            <span>{texto("Plano contratado", "Current plan")}</span>
            <strong>{assinatura ? nomes[assinatura.Plano] ?? assinatura.Plano : "—"}</strong>
          </div>
          <div className={styles.managementStat}>
            <span>{texto("Situação do acesso", "Access status")}</span>
            <strong className={assinatura?.AcessoAtivo ? styles.active : styles.inactive}>
              {assinatura ? (assinatura.AcessoAtivo ? t("subscription.active") : t("subscription.suspended")) : "—"}
            </strong>
          </div>
          <div className={styles.managementStat}>
            <span>{texto("Válido até", "Valid until")}</span>
            <strong>{assinatura?.DataFim ? new Date(assinatura.DataFim).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US") : "—"}</strong>
          </div>
        </div>
      </section>}

      {(publicView || mostrarPlanos) && (
        <section id="subscription-plan-list" className={styles.plansSection}>
          <div className={styles.publicHeading}>
            <div><h1>{texto("Encontre o plano ideal para seu negócio", "Find the right plan for your business")}</h1><p>{texto("Compare recursos e escolha conforme sua operação cresce.", "Compare features and choose as your business grows.")}</p></div>
            <button className={styles.secondaryButton} type="button" onClick={() => navigate(-1)}>{texto("Voltar", "Back")}</button>
          </div>
          <div className={styles.grid} aria-label={t("subscription.available")}>
        {planos.map(plano => {
          const atual = assinatura?.Plano === plano.id;
          return (
            <article key={plano.id} className={`${styles.card} ${plano.id === "INTERMEDIARIO" ? styles.featured : ""}`}>
              <div className={styles.cardTop}>
                <h3 className={styles.cardName}>{nomes[plano.id] ?? plano.nome}</h3>
                {atual ? <span className={styles.tag}>{t("subscription.current")}</span> : plano.id === "INTERMEDIARIO" ? <span className={styles.tag}>{t("subscription.mostPopular")}</span> : null}
              </div>
              <p className={styles.price}>{reais.format(plano.valor)} <small>/{t("subscription.month")}</small></p>
              <p className={styles.description}>
                {plano.id === "BASICO" ? t("subscription.basicDesc") :
                 plano.id === "INTERMEDIARIO" ? t("subscription.intermediateDesc") :
                 t("subscription.advancedDesc")}
              </p>
              <ul className={styles.features}>
                <li className={styles.feature}><FaCheck className={styles.featureIcon} aria-hidden="true" /> {plano.id === "AVANCADO" ? t("subscription.allServices") : `${plano.id === "BASICO" ? 4 : 8} ${t("subscription.services").toLowerCase()}`}</li>
                <li className={styles.feature}><FaCheck className={styles.featureIcon} aria-hidden="true" /><span>{plano.id === "AVANCADO" ? t("subscription.allPros") : `${plano.id === "BASICO" ? 2 : 4} ${t("subscription.professionals")}`} <span className={styles.comingSoon}>{t("subscription.companyOnly")}</span></span></li>
                <li className={styles.feature}>
                  {plano.relatorios ? <FaCheck className={styles.featureIcon} aria-hidden="true" /> : <FaTimes className={styles.off} aria-hidden="true" />}
                  <span className={plano.relatorios ? "" : styles.off}>{plano.relatorios ? t("subscription.reports") : t("subscription.noReports")}</span>
                </li>
                <li className={styles.feature}><FaCheck className={styles.featureIcon} aria-hidden="true" /> {t("subscription.agenda")}</li>
                <li className={styles.feature}>
                  {plano.id === "AVANCADO"
                    ? <FaCheck className={styles.featureIcon} aria-hidden="true" />
                    : <FaTimes className={styles.off} aria-hidden="true" />}
                  <span className={plano.id === "AVANCADO" ? "" : styles.off}>
                    {t("subscription.metrics")}
                  </span>
                </li>
                <li className={styles.feature}>
                  {plano.id === "AVANCADO"
                    ? <FaCheck className={styles.featureIcon} aria-hidden="true" />
                    : <FaTimes className={styles.off} aria-hidden="true" />}
                  <span className={plano.id === "AVANCADO" ? "" : styles.off}>
                    {t("subscription.whatsappAutomation")}
                    {plano.id === "AVANCADO" && <> <span className={styles.comingSoon}>{t("subscription.inDevelopment")}</span></>}
                  </span>
                </li>
              </ul>
              <button className={styles.button} type="button"
                disabled={carregandoRecursos || Boolean(pending) || (Boolean(usuario?.Id) && (loading || !assinatura || atual))}
                onClick={() => { if (!usuario?.Id) navigate("/global/login"); else void selecionarPlano(plano.id); }}>
                {atual && usuario?.Id ? t("subscription.currentLabel") : !usuario?.Id ? texto("Entrar para contratar", "Sign in to subscribe") : pending === plano.id ? t("subscription.processing") :
                 assinatura?.AcessoAtivo && assinatura.Plano !== "GRATIS" && assinatura.Plano !== "SEM_PLANO" ? t("subscription.change") : t("subscription.select")}
              </button>
            </article>
          );
        })}
          </div>
          <p className={styles.note}>{t("subscription.freeNote")}</p>
        </section>
      )}
      {destino && (() => {
        const limiteServicos = destino === "BASICO" ? 4 : destino === "INTERMEDIARIO" ? 8 : Infinity;
        const limiteProfissionais = destino === "BASICO" ? 2 : destino === "INTERMEDIARIO" ? 4 : Infinity;
        const servicos = recursos.filter(item => item.Tipo === "SERVICO");
        const profissionais = recursos.filter(item => item.Tipo === "PROFISSIONAL");
        const ids = (itens: RecursoPlano[]) => itens.filter(x=>selecionados.includes(`${x.Tipo}:${x.Id}`)).map(x=>x.Id);
        const validos = (servicos.length <= limiteServicos || ids(servicos).length === limiteServicos) &&
          (profissionais.length <= limiteProfissionais || ids(profissionais).length === limiteProfissionais);
        return <Modal open title={t("subscription.keepResources")}
          onClose={()=>{setDestino(null);setEditandoRecursos(false);}} busy={Boolean(pending)}
          actions={<>
            <button type="button" className={styles.secondaryButton} disabled={Boolean(pending)}
              onClick={()=>{setDestino(null);setEditandoRecursos(false);}}>{t("common.cancel")}</button>
            <button type="button" className={styles.button} disabled={!validos || Boolean(pending)}
              onClick={()=>void confirmarTroca(destino,
                servicos.length > limiteServicos ? ids(servicos) : undefined,
                profissionais.length > limiteProfissionais ? ids(profissionais) : undefined)}>
              {editandoRecursos ? t("subscription.saveResources") : t("subscription.continue")}
            </button>
          </>}>
          <p>{t("subscription.keepNotice")}</p>
          {([["SERVICO",servicos,limiteServicos],["PROFISSIONAL",profissionais,limiteProfissionais]] as const).map(([tipo,itens,limite]) =>
            itens.length > limite && <fieldset key={tipo} className={styles.selectionGroup}>
              <legend>{tipo === "SERVICO" ? t("subscription.services") : t("subscription.professionalsLabel")} — {t("subscription.selectCount")} {limite} {t("subscription.of")} {itens.length}</legend>
              {itens.map(item=><label key={item.Id} className={styles.resource}>
                <input type="checkbox" checked={selecionados.includes(`${item.Tipo}:${item.Id}`)}
                  onChange={()=>alternarRecurso(`${item.Tipo}:${item.Id}`)} />
                {item.Nome}
              </label>)}
            </fieldset>)}
        </Modal>;
      })()}
      <Modal open={Boolean(confirmacao)} title={t("subscription.confirm")}
        onClose={()=>setConfirmacao(null)} busy={Boolean(pending)}
        actions={<>
          <button type="button" className={styles.secondaryButton} disabled={Boolean(pending)} onClick={()=>setConfirmacao(null)}>Cancelar</button>
          <button type="button" className={styles.button} disabled={Boolean(pending)} onClick={()=>void aplicarTroca()}>
            {pending ? t("subscription.changing") : t("subscription.apply")}
          </button>
        </>}>
        <p>{t("subscription.changeTo")} <strong>{nomes[confirmacao?.plano ?? ""]}</strong> por <strong>{reais.format(planos.find(item=>item.id===confirmacao?.plano)?.valor ?? 0)}/{t("subscription.month")}</strong>?</p>
        {assinatura?.Status === "CANCELAMENTO_PENDENTE" && <p><strong>{t("subscription.renewal")}:</strong> {t("subscription.renewalNotice")}</p>}
        <p>{t("subscription.chargeNotice")}</p>
      </Modal>
    </main>
  );
}
