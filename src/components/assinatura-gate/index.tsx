import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import LoadingState from "@/components/loading-state";
import { consultarAssinatura, type AssinaturaAtual } from "@/services/assinatura-service";

export default function AssinaturaGate({ children, relatorios = false, avancado = false }: { children: ReactNode; relatorios?: boolean; avancado?: boolean }) {
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
  if (!state && !erro) return <LoadingState label="Verificando assinatura" />;
  if (erro || !state) return <p style={{ padding: 24 }}>Não foi possível validar sua assinatura. Tente atualizar a página.</p>;
  if (!state.AcessoAtivo || (relatorios && !state.RelatoriosLiberados) || (avancado && state.Plano !== "AVANCADO"))
    return <main style={{ padding: 32 }}>
      <h1>{!state.AcessoAtivo ? "Assinatura necessária" : avancado && state.Plano !== "AVANCADO" ? "Recurso exclusivo do Avançado" : "Recurso do Intermediário e Avançado"}</h1>
      <p>{!state.AcessoAtivo
        ? "Seu período gratuito ou assinatura terminou. Selecione um plano para continuar."
        : avancado && state.Plano !== "AVANCADO" ? "Análise de dados está disponível exclusivamente no plano Avançado." : "Os relatórios estão disponíveis a partir do plano Intermediário."}</p>
      <Link to={base + "/assinatura"}>Ver planos</Link>
    </main>;
  return <>{children}</>;
}
