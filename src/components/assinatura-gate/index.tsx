import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import LoadingState from "@/components/loading-state";
import { useLanguage } from "@/context/LanguageContext";
import { consultarAssinatura, type AssinaturaAtual } from "@/services/assinatura-service";
import { formatAgendaDateParam, listarAgendaPorData } from "@/services/agendamento-service";
import { getStoredUser } from "@/services/auth-token";
import { DashboardLoadingShell, type DashboardInitialAgenda } from "@/pages/others/dashboard";

type GateChildren = ReactNode | ((data: DashboardInitialAgenda) => ReactNode);

export default function AssinaturaGate({
  children,
  relatorios = false,
  avancado = false,
  whatsappOnly = false,
  preloadDashboard = false,
}: {
  children: GateChildren;
  relatorios?: boolean;
  avancado?: boolean;
  whatsappOnly?: boolean;
  preloadDashboard?: boolean;
}) {
  const { t } = useLanguage();
  const location = useLocation();
  const base = location.pathname.startsWith("/empresa/") ? "/empresa" : "/autonomo";
  const [state, setState] = useState<AssinaturaAtual | null>(null);
  const [erro, setErro] = useState(false);
  const [initialAgenda, setInitialAgenda] = useState<DashboardInitialAgenda | null>(null);

  useEffect(() => {
    let active = true;
    const checkAccessAndLoad = async () => {
      try {
        const subscription = await consultarAssinatura();
        if (!active) return;

        // No Dashboard, o gate segura o mesmo skeleton até a primeira
        // consulta terminar. Assim não há dois carregamentos em sequência.
        // Nenhum dado da agenda é buscado antes da autorização de acesso.
        if (preloadDashboard && subscription.AcessoAtivo) {
          const user = getStoredUser<{ Id?: number }>();
          let result: DashboardInitialAgenda = { appointments: [], failed: true };
          if (user?.Id) {
            try {
              const appointments = await listarAgendaPorData(
                user.Id,
                formatAgendaDateParam(new Date()),
              );
              result = { appointments, failed: false };
            } catch {
              // O Dashboard mostrará o erro, sem iniciar outro skeleton.
            }
          }
          if (!active) return;
          setInitialAgenda(result);
        }

        setState(subscription);
      } catch {
        if (active) setErro(true);
      }
    };

    void checkAccessAndLoad();
    return () => { active = false; };
  }, [preloadDashboard]);

  if (!state && !erro) {
    return preloadDashboard
      ? <DashboardLoadingShell />
      : <LoadingState label={t("gate.verifying")} />;
  }
  if (erro || !state) return <p style={{ padding: 24 }}>{t("gate.error")}</p>;
  if (!state.AcessoAtivo && !erro) return <Navigate to={base + "/assinatura/planos"} replace />;
  if ((relatorios && state.Plano !== "GRATIS" && !state.RelatoriosLiberados) || (avancado && state.Plano !== "AVANCADO" && state.Plano !== "GRATIS") || (whatsappOnly && state.Plano !== "AVANCADO"))
    return <main style={{ padding: 32 }}>
      <h1>{!state.AcessoAtivo ? t("gate.subscriptionNeeded") : (whatsappOnly || (avancado && state.Plano !== "AVANCADO" && state.Plano !== "GRATIS")) ? t("gate.advancedOnly") : t("gate.intermediateOnly")}</h1>
      <p>{!state.AcessoAtivo
        ? t("gate.trialEnded")
        : (whatsappOnly || (avancado && state.Plano !== "AVANCADO" && state.Plano !== "GRATIS")) ? t("gate.analyticsOnly") : t("gate.reportsOnly")}</p>
      <Link to={base + "/assinatura"}>{t("gate.viewPlans")}</Link>
    </main>;
  if (preloadDashboard && initialAgenda && typeof children === "function") {
    return <>{children(initialAgenda)}</>;
  }
  return <>{typeof children === "function" ? null : children}</>;
}
