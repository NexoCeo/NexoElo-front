import { useEffect, type CSSProperties } from "react";
import { FaArrowRight, FaRocket, FaTimes } from "react-icons/fa";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import styles from "./style.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  plan: "BASICO" | "INTERMEDIARIO";
  limit: number;
  onViewPlans: () => void;
};

export default function UpgradePlanModal({ open, onClose, plan, limit, onViewPlans }: Props) {
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
  const nextPlan = plan === "BASICO" ? "INTERMEDIARIO" : "AVANCADO";
  const nextName = nextPlan === "INTERMEDIARIO"
    ? (isPt ? "Intermediário" : "Intermediate")
    : (isPt ? "Avançado" : "Advanced");
  const nextPrice = nextPlan === "INTERMEDIARIO" ? "R$ 49,99" : "R$ 99,99";
  return (
    <div className={styles.overlay} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="upgrade-title"
        style={{ "--upgrade-text": theme.colors.text, "--upgrade-muted": theme.colors.inactive,
          "--upgrade-bg": theme.colors.background2, "--upgrade-border": theme.colors.bottom,
          "--upgrade-accent": theme.colors.primary, "--upgrade-button": theme.colors.text,
          "--upgrade-button-text": theme.colors.background2 } as CSSProperties}>
        <div className={styles.top}>
          <span className={styles.icon}><FaRocket aria-hidden="true" /></span>
          <span className={styles.plan}>{isPt ? "Plano" : "Plan"} {plan === "BASICO" ? (isPt ? "Básico" : "Basic") : nextPlan === "AVANCADO" ? (isPt ? "Intermediário" : "Intermediate") : plan}</span>
        </div>
        <button type="button" className={styles.close} aria-label={isPt ? "Fechar" : "Close"} onClick={onClose}><FaTimes /></button>
        <h2 id="upgrade-title">{isPt ? "Pronto para expandir seus atendimentos?" : "Ready to grow your bookings?"}</h2>
        <p>{isPt ? `Você atingiu o limite de ${limit} serviços do seu plano atual.` : `You reached your current plan's limit of ${limit} services.`}</p>
        <p>{nextPlan === "INTERMEDIARIO"
          ? (isPt ? "Com o plano Intermediário, você pode cadastrar até 8 serviços e continuar expandindo seu negócio." : "With the Intermediate plan, you can register up to 8 services and keep growing your business.")
          : (isPt ? "Com o plano Avançado, você pode cadastrar serviços ilimitados e continuar expandindo seu negócio." : "With the Advanced plan, you can register unlimited services and keep growing your business.")}</p>
        <div className={styles.price}><strong>{nextPrice}</strong><span>{isPt ? "/mês" : "/month"}</span></div>
        <p className={styles.benefit}>{nextPlan === "INTERMEDIARIO"
          ? (isPt ? "4 serviços adicionais disponíveis no plano Intermediário." : "4 additional services with the Intermediate plan.")
          : (isPt ? "Serviços ilimitados disponíveis no plano Avançado." : "Unlimited services with the Advanced plan.")}</p>
        <button className={styles.cta} type="button" onClick={onViewPlans}>
          {isPt ? "Conhecer outros planos" : "Explore other plans"} <FaArrowRight aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}
