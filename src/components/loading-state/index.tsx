import styles from "./style.module.css";

type LoadingStateProps = {
  label?: string;
  compact?: boolean;
};

export default function LoadingState({ label = "Carregando", compact = false }: LoadingStateProps) {
  return (
    <div className={`${styles.loading} ${compact ? styles.compact : ""}`} role="status" aria-live="polite" aria-label={label}>
      <span className={styles.spinner} aria-hidden="true" />
      <span className={styles.srOnly}>{label}</span>
    </div>
  );
}
