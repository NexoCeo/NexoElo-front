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
      setError("As senhas não coincidem.");
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
      setError("Erro ao alterar a senha.");
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
            required: "A nova senha é obrigatória.",
            minLength: {
              value: 8,
              message: "A senha deve ter no mínimo 8 caracteres."
            }
          }}
          render={({ field }) => (
            <InputGeneric
              type={showNovaSenha ? 'text' : 'password'}
              placeholder="Digite uma nova senha."
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
            required: "A confirmação de senha é obrigatória.",
            validate: (value) => value === watch('novaSenha') || "As senhas não coincidem."
          }}
          render={({ field }) => (
            <InputGeneric
              type={showConfirmarSenha ? 'text' : 'password'}
              placeholder="Confirme a nova senha!"
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
        {loading ? <span className={styles.spinner}></span> : "Alterar senha"}
      </button>
    </form>
  );
}
