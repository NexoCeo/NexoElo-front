import { ReactNode } from 'react';
import styles from './style.module.css';
import { useTheme } from '../../context/ThemeContext';

interface InputGenericProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string; 
  type?: string;
  name?: string;
  icon: ReactNode;
}

export function InputGeneric({ value, onChange, placeholder, type, name, icon  }: InputGenericProps) {
  const { theme } = useTheme();
  
  return (
    <div 
      className={styles.container} 
      style={{ 
        backgroundColor: theme.colors.background, 
        borderColor: theme.colors.background2 
      }}
    >
      <input
        type={type}
        name={name}
        className={styles.input}
        style={{ color: theme.colors.text}}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
      />
      <span className={styles.icon}>
        {icon}
      </span>
    </div>
  );
}
