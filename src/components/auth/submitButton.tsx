import type { ReactNode } from "react";
import { useTheme } from "@/context/ThemeContext";
import styles from "./submitButton.module.css";

type SubmitButtonProps = {
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
};

export function SubmitButton({ children, disabled = false, loading = false }: SubmitButtonProps) {
  const { theme } = useTheme();
  return (
    <button
      type="submit"
      className={styles.button}
      style={{
        backgroundColor: disabled || loading ? theme.colors.inactive : theme.colors.primary,
        color: theme.colors.onPrimary,
      }}
      disabled={disabled || loading}
    >
      {loading ? <span className={styles.spinner} role="status" aria-label="Aguarde" /> : children}
    </button>
  );
}
