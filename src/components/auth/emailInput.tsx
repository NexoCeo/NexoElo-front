import { useLanguage } from "@/context/LanguageContext";
import { FaEnvelope } from 'react-icons/fa';
import styles from './authInputs.module.css';
import { useTheme } from '../../context/ThemeContext';

interface EmailInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function EmailInput({ value, onChange }: EmailInputProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  
  return (
    <div className={styles.container} style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.background2 }}>
      <input
        type="email"
        name="email"
        autoComplete="email"
        className={styles.input}
        style={{ color: theme.colors.text}}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("auth.enterEmail")}
        required
      />
      <span className={styles.icon}>
        <FaEnvelope size={20} />
      </span>
    </div>
  );
}
