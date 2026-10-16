import { useEffect, type ReactNode } from "react";
import styles from "./style.module.css";
import { useLanguage } from "@/context/LanguageContext";

type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
  busy?: boolean;
};

export default function Modal({ open, title, children, onClose, actions, busy = false }: ModalProps) {
  const { t } = useLanguage();
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, busy, onClose]);

  if (!open) return null;
  return (
    <div className={styles.backdrop} onMouseDown={event => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-label={title}>
        <header className={styles.header}>
          <h2>{title}</h2>
          <button className={styles.close} type="button" aria-label={t("common.close")} disabled={busy} onClick={onClose}>×</button>
        </header>
        <div className={styles.body}>{children}</div>
        {actions && <footer className={styles.actions}>{actions}</footer>}
      </section>
    </div>
  );
}
