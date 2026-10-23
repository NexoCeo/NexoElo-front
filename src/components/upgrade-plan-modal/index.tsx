import { useEffect, type CSSProperties } from "react";
import { FaArrowRight, FaRocket, FaTimes } from "react-icons/fa";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import styles from "./style.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  plan?: "BASICO" | "INTERMEDIARIO";
  limit?: number;
  variant?: "LIMIT" | "TRIAL_EXPIRED";
  resource?: "SERVICO" | "PROFISSIONAL";
  onViewPlans: () => void;
};

export default function UpgradePlanModal({ open, onClose, plan = "BASICO", limit = 0, variant = "LIMIT", resource = "SERVICO", onViewPlans }: Props) {
  const { lang } = useLanguage();
  const { theme } = useTheme();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const isPt = lang === "pt";
  const isProfessional = resource === "PROFISSIONAL";
  const trialExpired = variant === "TRIAL_EXPIRED";
  const nextPlan = plan === "BASICO" ? "INTERMEDIARIO" : "AVANCADO";
  const nextPrice = nextPlan === "INTERMEDIARIO" ? "R$ 49,99" : "R$ 99,99";
  return (
    <div className={styles.overlay} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="upgrade-title"
        style={{ "--upgrade-text": theme.colors.text, "--upgrade-muted": theme.colors.inactive,
          "--upgrade-bg": theme.colors.background2, "--upgrade-border": theme.colors.bottom,
          "--upgrade-accent": theme.colors.primary, "--upgrade-button": theme.colors.text,
          "--upgrade-button-text": theme.colors.background2 } as CSSProperties}>
        <div className={styles.closeRow}><button type="button" className={styles.close} aria-label={isPt ? "Fechar" : "Close"} onClick={onClose}><FaTimes /></button></div>
        <div className={styles.top}>
          <span className={styles.icon}><FaRocket aria-hidden="true" /></span>
          <span className={styles.plan}>{trialExpired ? (isPt ? "30 dias concluídos" : "30 days completed") : <>{isPt ? "Plano" : "Plan"} {plan === "BASICO" ? (isPt ? "Básico" : "Basic") : nextPlan === "AVANCADO" ? (isPt ? "Intermediário" : "Intermediate") : plan}</>}</span>
        </div>
                {trialExpired ? (
          <>
            <h2 id="upgrade-title">{isPt ? "Seu período gratuito chegou ao fim!" : "Your free trial has ended!"}</h2>
            <p>{isPt ? "Seus 30 dias de acesso gratuito terminaram. Obrigado por experimentar o NexoElo." : "Your 30-day free trial has ended. Thank you for trying NexoElo."}</p>
            <p>{isPt ? "Seus serviços, clientes e agendamentos estão preservados. Escolha um plano para continuar gerenciando seu negócio." : "Your services, clients and appointments are preserved. Choose a plan to continue managing your business."}</p>
          </>
        ) : (
          <>
        <h2 id="upgrade-title">{isPt ? "Pronto para expandir seus atendimentos?" : "Ready to grow your bookings?"}</h2>
        <p>{isPt ? `Você atingiu o limite de ${limit} ${isProfessional ? "profissionais" : "serviços"} do seu plano atual.` : `You reached your current plan's limit of ${limit} ${isProfessional ? "professionals" : "services"}.`}</p>
        <p>{nextPlan === "INTERMEDIARIO"
          ? (isPt ? `Com o plano Intermediário, você pode cadastrar até ${isProfessional ? 4 : 8} ${isProfessional ? "profissionais" : "serviços"} e continuar expandindo seu negócio.` : `With the Intermediate plan, you can register up to ${isProfessional ? 4 : 8} ${isProfessional ? "professionals" : "services"} and keep growing your business.`)
          : (isPt ? `Com o plano Avançado, você pode cadastrar ${isProfessional ? "profissionais" : "serviços"} ilimitados e continuar expandindo seu negócio.` : `With the Advanced plan, you can register unlimited ${isProfessional ? "professionals" : "services"} and keep growing your business.`)}</p>
        <div className={styles.price}><strong>{nextPrice}</strong><span>{isPt ? "/mês" : "/month"}</span></div>
        <p className={styles.benefit}>{nextPlan === "INTERMEDIARIO"
          ? (isPt ? `Mais ${isProfessional ? 2 : 4} ${isProfessional ? "profissionais" : "serviços"} disponíveis no plano Intermediário.` : `${isProfessional ? 2 : 4} additional ${isProfessional ? "professionals" : "services"} with the Intermediate plan.`)
          : (isPt ? `${isProfessional ? "Profissionais" : "Serviços"} ilimitados disponíveis no plano Avançado.` : `Unlimited ${isProfessional ? "professionals" : "services"} with the Advanced plan.`)}</p>
          </>
        )}
        <button className={styles.cta} type="button" onClick={onViewPlans}>
          {isPt ? "Conhecer outros planos" : "Explore other plans"} <FaArrowRight aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}
