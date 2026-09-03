import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import styles from "./step.module.css";
import { useTheme } from '@/context/ThemeContext';
import api from "@/services/api";
import { InputGeneric } from '@/components/inputGeneric';
import { FaEnvelope } from "react-icons/fa";

interface FormData {
  email: string;
}

interface SolicitaEmailProps {
  onSuccess: (email: string) => void;
  onFailure: () => void;
}

export default function SolicitaEmail({ onSuccess, onFailure }: SolicitaEmailProps) {
  const { theme } = useTheme();
  const { control, handleSubmit } = useForm<FormData>({
    defaultValues: {
      email: '', 
    },
  });
  const [ loading, setLoading ] = useState(false);
  const [ error, setError ] = useState<string | null>(null);

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      setError(null);
      await api.post("/RecuperacaoSenha/enviar-codigo", {
        email: data.email,
      });
      onSuccess(data.email);
    } catch {
      onFailure();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.container}>
      <div className={styles.inputGroup} style={{ backgroundColor: theme.colors.background }}>
        <Controller
          name="email"
          control={control}
          rules={{ required: true }}
          render={({ field }) => (
            <InputGeneric
              type="email"
              placeholder="Digite seu email"
              icon={<FaEnvelope size={20} />}
              {...field}
            />
          )}
        />
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className={styles.button}
        style={{color: theme.colors.text}}
      >
        {loading ? <span className={styles.spinner}></span> : "Enviar código"}
      </button>
    </form>
  );
}
