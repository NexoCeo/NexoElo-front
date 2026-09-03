import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import styles from "./step.module.css";
import { useTheme } from '@/context/ThemeContext';
import api from "@/services/api";
import { InputGeneric } from "@/components/inputGeneric";
import { FaKey } from 'react-icons/fa';

interface FormData {
  codigo: string;
}

interface ValidaCodigoProps {
  email: string;
  onSuccess: (token: string) => void;
  onFailure: () => void;
}

export default function ValidaCodigo({ email, onSuccess, onFailure }: ValidaCodigoProps) {
  const { theme } = useTheme();
  const { control, handleSubmit } = useForm<FormData>({
    defaultValues: {
      codigo: '', 
    },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.post("/RecuperacaoSenha/validar-codigo", {
        email,
        codigo: data.codigo,
      });
      const tokenTemporario = response.data.tokenTemporario;
      onSuccess(tokenTemporario);
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
          name="codigo"
          control={control}
          rules={{ required: true }}
          render={({ field }) => (
            <InputGeneric
              type="text"
              placeholder="Digite o código recebido"
              icon={<FaKey size={20} />}
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
