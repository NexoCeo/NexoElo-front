import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import LoadingState from "@/components/loading-state";
import { useLanguage } from "@/context/LanguageContext";
import { consultarAssinatura, type AssinaturaAtual } from "@/services/assinatura-service";

export default function AssinaturaGate({ children, relatorios = false, avancado = false }: { children: ReactNode; relatorios?: boolean; avancado?: boolean }) {
  const { t } = useLanguage();
  const location = useLocation();
  const base = location.pathname.startsWith("/empresa/") ? "/empresa" : "/autonomo";
  const [state, setState] = useState<AssinaturaAtual | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let active = true;
    consultarAssinatura().then(data => { if (active) setState(data); })
      .catch(() => { if (active) setErro(true); });
    return () => { active = false; };
  }, []);
  if (!state && !erro) return <LoadingState label={t("gate.verifying")} variant={location.pathname.endsWith("/agenda") ? "agenda" : location.pathname.endsWith("/servicos") ? "services" : location.pathname.endsWith("/funcionamento") ? "hours" : location.pathname.endsWith("/relatorios") ? "reports" : undefined} />;
  if (erro || !state) return <p style={{ padding: 24 }}>{t("gate.error")}</p>;
  if (!state.AcessoAtivo || (relatorios && state.Plano !== "GRATIS" && !state.RelatoriosLiberados) || (avancado && state.Plano !== "AVANCADO" && state.Plano !== "GRATIS"))
    return <main style={{ padding: 32 }}>
      <h1>{!state.AcessoAtivo ? t("gate.subscriptionNeeded") : avancado && state.Plano !== "AVANCADO" && state.Plano !== "GRATIS" ? t("gate.advancedOnly") : t("gate.intermediateOnly")}</h1>
      <p>{!state.AcessoAtivo
        ? t("gate.trialEnded")
        : avancado && state.Plano !== "AVANCADO" && state.Plano !== "GRATIS" ? t("gate.analyticsOnly") : t("gate.reportsOnly")}</p>
      <Link to={base + "/assinatura"}>{t("gate.viewPlans")}</Link>
    </main>;
  return <>{children}</>;
}
