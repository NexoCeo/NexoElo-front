import { FaEnvelope, FaPhoneAlt } from "react-icons/fa";
import styles from "./style.module.css";

type ProfileOverviewProps = {
  name: string;
  role: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  className?: string;
  action?: React.ReactNode;
  subtitle?: string;
};

function formatPhone(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length === 11) return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return value || "Não informado";
}

export default function ProfileOverview({ name, role, email, phone, avatarUrl, className, action, subtitle }: ProfileOverviewProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <section className={`${styles.profile} ${className || ""}`} aria-label="Informações do perfil">
      <div className={styles.avatar}>
        {avatarUrl ? <img src={avatarUrl} alt={`Foto de ${name}`} /> : <span aria-hidden="true">{initial}</span>}
      </div>
      <div className={styles.heading}>
        <h2>{name}</h2>
        <span className={styles.role}>{role}</span>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <dl className={styles.details}>
        <div><dt><FaEnvelope aria-hidden="true" /> E-mail</dt><dd>{email || "Não informado"}</dd></div>
        <div><dt><FaPhoneAlt aria-hidden="true" /> Telefone</dt><dd>{formatPhone(phone)}</dd></div>
      </dl>
      {action && <div className={styles.action}>{action}</div>}
    </section>
  );
}
