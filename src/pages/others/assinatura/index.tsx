import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useNotification } from "@/context/NotificationContext";
import { consultarAssinatura, iniciarCheckout, abrirPortal, planos, type AssinaturaAtual } from "@/services/assinatura-service";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function MinhaAssinatura() {
  const { usuario } = useUser();
  const { showNotification } = useNotification();
  const [assinatura, setAssinatura] = useState<AssinaturaAtual | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState("");

  useEffect(() => {
    let active = true;
    consultarAssinatura()
      .then(data => { if (active) setAssinatura(data); })
      .catch(() => showNotification({ type: "error", title: "Assinatura", message: "Nao foi possivel carregar sua assinatura." }))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showNotification]);

  async function executar(chave: string, acao: () => Promise<void>) {
    setPending(chave);
    try { await acao(); }
    catch { showNotification({ type: "error", title: "Assinatura", message: "Nao foi possivel abrir a cobranca. Tente novamente." }); }
    finally { setPending(""); }
  }

  const painel = { maxWidth: 1050, margin: "0 auto", padding: "32px 20px", color: "var(--theme-text, inherit)" };
  return (
    <main style={painel}>
      <header style={{ marginBottom: 28 }}>
        <h1>Minha assinatura</h1>
        <p>Consulte seu plano, seus limites e as opções de contratação.</p>
        {loading ? <p>Carregando assinatura...</p> : assinatura ? (
          <section style={{ padding: 20, border: "1px solid var(--theme-bottom, #64748b)", borderRadius: 12 }}>
            <h2>{assinatura.Plano === "GRATIS" ? "Grátis — 30 dias" : assinatura.Plano.replace("_", " ")}</h2>
            <p>{assinatura.AcessoAtivo ? "Acesso ativo" : "Acesso suspenso: escolha um plano para continuar."}</p>
            {assinatura.DataFim && <p>Data de término: {new Date(assinatura.DataFim).toLocaleDateString("pt-BR")}</p>}
            {assinatura.Plano === "GRATIS" && <p>Durante o período gratuito, todas as funcionalidades ficam liberadas.</p>}
            {assinatura.Plano !== "GRATIS" && assinatura.Plano !== "SEM_PLANO" && (
              <button type="button" disabled={Boolean(pending)} onClick={() => usuario?.Id && executar("portal", () => abrirPortal(usuario.Id))}>
                Gerenciar assinatura e pagamentos
              </button>
            )}
          </section>
        ) : null}
      </header>
      <h2>Escolha seu plano</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 18 }}>
        {planos.map(plano => (
          <article key={plano.id} style={{ border: "1px solid var(--theme-bottom, #64748b)", borderRadius: 14, padding: 22 }}>
            <h3>{plano.nome}</h3>
            <p style={{ fontSize: 27, fontWeight: 700 }}>{reais.format(plano.valor)}<small style={{ fontSize: 14 }}>/mês</small></p>
            <p>{plano.servicos}</p>
            <p>{plano.profissionais}</p>
            <p>{plano.relatorios ? "Relatórios PDF incluídos" : "Sem relatórios PDF"}</p>
            <button type="button" disabled={loading || Boolean(pending) || !usuario?.Id || assinatura?.Plano === plano.id}
              onClick={() => usuario?.Id && executar(plano.id, () => iniciarCheckout(usuario.Id, plano.id))}>
              {assinatura?.Plano === plano.id ? "Seu plano atual" : pending === plano.id ? "Redirecionando..." : "Selecionar plano"}
            </button>
          </article>
        ))}
      </div>
      <p style={{ marginTop: 20 }}>Se você reduzir o plano, seus dados e histórico serão preservados. Recursos acima do limite precisarão ser regularizados.</p>
    </main>
  );
}
