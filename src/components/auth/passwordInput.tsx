import { FaEye, FaEyeSlash } from 'react-icons/fa';
import styles from './authInputs.module.css';
import { useTheme } from '../../context/ThemeContext';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  showPassword: boolean;
  togglePassword: () => void;
}

export function PasswordInput({ value, onChange, showPassword, togglePassword }: PasswordInputProps) {
  const { theme } = useTheme();
  
  return (
     <div className={styles.container} style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.background2 }}>
        <input
          type={showPassword ? 'text' : 'password'}
          name="password"
          autoComplete="current-password"
          className={styles.input}
          style={{ color: theme.colors.text}}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Digite sua senha"
          required
        />
        <span onClick={togglePassword} className={`${styles.icon} ${styles.passwordIcon}`}>
          {showPassword ? <FaEyeSlash size={20} /> : <FaEye size={20} />}
        </span>
    </div>
  );
}
