import { useLanguage } from "@/context/LanguageContext";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import api from "@/services/api";
import styles from "./step.module.css";
import { useTheme } from '@/context/ThemeContext';
import { InputGeneric } from "@/components/inputGeneric";
import { FaLock, FaLockOpen } from 'react-icons/fa';

interface FormData {
  novaSenha: string;
  confirmarSenha: string;
}

interface AlteraSenhaProps {
  tokenTemporario: string;
  onSuccess: () => void;
  onFailure: () => void;
}

export default function AlteraSenha({ tokenTemporario, onSuccess, onFailure }: AlteraSenhaProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { control, handleSubmit, formState: { errors }, watch } = useForm<FormData>({
    defaultValues: {
      novaSenha: '',
      confirmarSenha: '',
    },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);

  const onSubmit = async (data: FormData) => {
    if (data.novaSenha !== data.confirmarSenha) {
      setError(t("password.mismatch"));
      return;
    }
    try {
      setLoading(true);
      setError(null);

      await api.post("/RecuperacaoSenha/redefinir-senha", {
        tokenTemporario,
        novaSenha: data.novaSenha,
      });

      onSuccess();

    } catch {
      setError(t("password.changeError"));
      onFailure();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.container}>
      <div className={styles.inputGroup} style={{ backgroundColor: theme.colors.background }}>
        <Controller
          name="novaSenha"
          control={control}
          rules={{ 
            required: t("password.required"),
            minLength: {
              value: 8,
              message: t("password.minLength")
            }
          }}
          render={({ field }) => (
            <InputGeneric
              type={showNovaSenha ? 'text' : 'password'}
              placeholder={t("password.newPlaceholder")}
              icon={
                <span onClick={() => setShowNovaSenha(!showNovaSenha)} style={{ cursor: 'pointer' }}>
                  {showNovaSenha ? <FaLockOpen size={20} /> : <FaLock size={20} />}
                </span>
              }
              {...field}
            />
          )}
        />
        {errors.novaSenha && <p className={styles.error}>{errors.novaSenha.message}</p>}
        <Controller
          name="confirmarSenha"
          control={control}
          rules={{ 
            required: t("password.confirmRequired"),
            validate: (value) => value === watch('novaSenha') || t("password.mismatch")
          }}
          render={({ field }) => (
            <InputGeneric
              type={showConfirmarSenha ? 'text' : 'password'}
              placeholder={t("password.confirmPlaceholder")}
               icon={
                <span onClick={() => setShowConfirmarSenha(!showConfirmarSenha)} style={{ cursor: 'pointer' }}>
                  {showConfirmarSenha ? <FaLockOpen size={20} /> : <FaLock size={20} />}
                </span>
              }
              {...field}
            />
          )}
        />
        {errors.confirmarSenha && <p className={styles.error}>{errors.confirmarSenha.message}</p>}
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className={styles.button}
        style={{color: theme.colors.text}}
      >
        {loading ? <span className={styles.spinner}></span>  : t("password.change")}
      </button>
    </form>
  );
}
