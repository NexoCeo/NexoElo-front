import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { isAxiosError } from "axios";
import {
  isValidClienteFinalLogin,
  loginClienteFinal,
} from "@/services/cliente-final-auth-service";
import { useNotification } from "@/context/NotificationContext";

export function useClienteFinalLoginForm() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [searchParams] = useSearchParams();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const validatePassword = (value: string) => value.length >= 6;
  const isFormValid = () => isValidClienteFinalLogin(login) && validatePassword(senha);
  const redirectTo = searchParams.get("redirectTo");
  const safeRedirectTo = redirectTo?.startsWith("/cliente-final/") ? redirectTo : "/cliente-final/home";

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!isValidClienteFinalLogin(login)) {
      const message = "Informe um e-mail ou telefone valido.";
      setError(message);
      showNotification({ type: "warning", title: "Acesso incompleto", message });
      return;
    }

    if (!validatePassword(senha)) {
      const message = "A senha deve ter pelo menos 6 caracteres.";
      setError(message);
      showNotification({ type: "warning", title: "Senha invalida", message });
      return;
    }

    try {
      setLoading(true);
      await loginClienteFinal({ login, senha });
      showNotification({
        type: "success",
        title: "Acesso realizado",
        message: "Bem-vindo(a) de volta!",
      });
      navigate(safeRedirectTo, { replace: true });
    } catch (err) {
      let message: string;
      if (isAxiosError<{ message?: string; title?: string }>(err)) {
        message = err.response?.data?.message || err.response?.data?.title || "Nao foi possivel entrar.";
      } else if (err instanceof Error) {
        message = err.message;
      } else {
        message = "Nao foi possivel entrar.";
      }
      setError(message);
      showNotification({ type: "error", title: "Erro ao entrar", message });
    } finally {
      setLoading(false);
    }
  }

  return {
    login,
    senha,
    showPassword,
    error,
    loading,
    redirectTo: safeRedirectTo,
    setLogin,
    setSenha,
    setShowPassword,
    isFormValid,
    handleLogin,
  };
}
