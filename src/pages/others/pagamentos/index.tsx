import { useEffect, useState } from "react";
import { useNotification } from "@/context/NotificationContext";
import {
  conectarContaRecebedora, consultarMinhaConfiguracaoPagamento,
  salvarModalidadePagamento, listarPagamentosPresenciaisPendentes, confirmarRecebimentoPresencial,
  type PagamentoPresencialPendente, type ConfiguracaoPagamento,
  type ModalidadePagamento
} from "@/services/pagamentos-agendamento-service";
import styles from "./style.module.css";

const MODALIDADES: { value: ModalidadePagamento; title: string; description: string }[] = [
  { value: "PRESENCIAL", title: "Pagamento presencial", description: "O cliente paga no estabelecimento após o atendimento." },
  { value: "ONLINE", title: "Pagamento online", description: "O cliente paga antecipadamente pela Stripe." },
  { value: "AMBOS", title: "Ambos", description: "O cliente escolhe entre pagar online ou no estabelecimento." },
];

export default function ConfiguracaoPagamentos() {
  const { showNotification } = useNotification();
  const [config, setConfig] = useState<ConfiguracaoPagamento | null>(null);
  const [modo, setModo] = useState<ModalidadePagamento>("PRESENCIAL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recebimentos, setRecebimentos] = useState<PagamentoPresencialPendente[]>([]);
  const [confirmando, setConfirmando] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    void listarPagamentosPresenciaisPendentes()
      .then(items => {if(active) setRecebimentos(items);})
      .catch(() => undefined);
    return () => {active=false;};
  }, []);
  async function confirmarRecebimento(id: number) {
    try {
      setConfirmando(id);
      await confirmarRecebimentoPresencial(id);
      setRecebimentos(items => items.filter(item => item.AgendamentoId !== id));
      showNotification({type:"success",title:"Pagamento registrado",message:"Recebimento presencial confirmado."});
    } catch {
      showNotification({type:"error",title:"Não foi possível confirmar",message:"Verifique a situação do pagamento antes de tentar novamente."});
    } finally {setConfirmando(null);}
  }

  useEffect(() => {
    let active = true;
    void consultarMinhaConfiguracaoPagamento().then(data => {
      if (!active) return;
      setConfig(data);
      setModo(data.Modalidade);
    }).catch(() => {
      if (active) showNotification({type:"error",title:"Configuração indisponível",message:"Não foi possível carregar as formas de pagamento."});
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showNotification]);

  async function salvar() {
    try {
      setSaving(true);
      await salvarModalidadePagamento(modo);
      setConfig(prev => prev ? {...prev, Modalidade: modo} : prev);
      showNotification({type:"success",title:"Pagamento configurado",message:"As opções foram atualizadas para os próximos agendamentos."});
    } catch {
      showNotification({type:"error",title:"Não foi possível salvar",message:"Para aceitar pagamento online, conecte primeiro sua conta Stripe e conclua a verificação."});
    } finally { setSaving(false); }
  }

  async function conectar() {
    try {
      await conectarContaRecebedora();
    } catch (error) {
      const response = error as { response?: { data?: { erro?: string; codigo?: string; stripeRequestId?: string } } };
      const details = response?.response?.data;
      const platformRestriction = details?.codigo === "account_creation_losses_collector_unavailable";
      const message = platformRestriction
        ? "A integração de pagamentos online da NexoCeo aguarda uma habilitação da Stripe. Não há pendência no seu cadastro. Você pode continuar aceitando pagamentos presenciais."
        : details?.erro || "Não foi possível iniciar a conexão da conta recebedora. Consulte os logs do backend.";
      showNotification({
        type: "error",
        title: platformRestriction ? "Integração Stripe pendente" : "Stripe indisponível",
        message,
      });
    }
  }

  return (
    <main className={styles.page}>
      <h1>Formas de pagamento</h1>
      <p className={styles.subtitle}>Defina como seus clientes poderão pagar pelos agendamentos. A assinatura do NexoElo não é afetada.</p>
      {loading ? <p>Carregando...</p> : <>
        <section className={styles.panel}>
          <h2>Recebimentos pela Stripe</h2>
          <p>O dinheiro dos atendimentos online será direcionado à sua conta de recebimento, não à conta usada na assinatura do NexoElo.</p>
          <p className={styles.state}>{config?.ContaConectada ? "Conta recebedora verificada e habilitada" :
            config?.ContaStripe ? "Conta conectada, aguardando habilitação da Stripe" : "Nenhuma conta recebedora conectada"}</p>
          <button type="button" onClick={() => void conectar()} className={styles.secondary}>
            {config?.ContaStripe ? "Continuar configuração na Stripe" : "Conectar minha conta Stripe"}
          </button>
        </section>
        <section className={styles.panel}>
          <h2>Quais pagamentos deseja aceitar?</h2>
          <div className={styles.options}>
            {MODALIDADES.map(item => (
              <label key={item.value} className={styles.option}>
                <input type="radio" name="modalidade" value={item.value}
                  checked={modo === item.value}
                  onChange={() => setModo(item.value)}
                  disabled={item.value !== "PRESENCIAL" && !config?.ContaConectada}/>
                <span><strong>{item.title}</strong><small>{item.description}</small></span>
              </label>
            ))}
          </div>
          <button type="button" className={styles.primary} disabled={saving || modo === config?.Modalidade}
            onClick={() => void salvar()}>{saving ? "Salvando..." : "Salvar configuração"}</button>
        </section>
        <section className={styles.panel}>
          <h2>Pagamentos presenciais pendentes</h2>
          <p>Confirme somente valores que já foram recebidos diretamente no estabelecimento.</p>
          {recebimentos.length === 0 ? <p>Nenhum recebimento pendente.</p> :
            <div className={styles.receivables}>
              {recebimentos.map(item => (
                <div className={styles.receivable} key={item.AgendamentoId}>
                  <span>
                    <strong>{item.Cliente} · Agendamento #{item.AgendamentoId}</strong>
                    <small>{new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(item.DataAgendamento))}</small>
                  </span>
                  <strong>{item.Valor.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong>
                  <button type="button" className={styles.secondary} disabled={confirmando !== null}
                    onClick={() => void confirmarRecebimento(item.AgendamentoId)}>
                    {confirmando === item.AgendamentoId ? "Confirmando..." : "Marcar como recebido"}
                  </button>
                </div>
              ))}
            </div>}
        </section>
      </>}
    </main>
  );
}
