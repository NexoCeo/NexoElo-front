import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { useUser } from "@/context/UserContext";
import { useNotification } from "@/context/NotificationContext";
import { Login } from "@/services/auth-service";
import { getRoleDashboardPath } from "@/routes/role-paths";

export function useLoginForm() {
  const navigate = useNavigate();

  const { setUsuario } = useUser();
  const { showNotification } = useNotification();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");

  const [loading, setLoading] = useState(false);

  const validateEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email.toLowerCase(),
    );

  const validatePassword = (password: string) =>
    password.length >= 8;

  const isFormValid = () =>
    validateEmail(email) &&
    validatePassword(senha);

  async function handleLogin(
    e: React.FormEvent,
  ) {
    e.preventDefault();

    setError("");
    setEmailError("");

    /*
     * Validação: campos vazios
     */
    if (!email || !senha) {
      const message =
        "Por favor, preencha todos os campos.";

      setError(message);

      showNotification({
        type: "warning",
        title: "Atenção",
        message,
      });

      return;
    }

    /*
     * Validação: e-mail
     */
    if (!validateEmail(email)) {
      const message =
        "Por favor, insira um e-mail válido.";

      setEmailError(message);

      showNotification({
        type: "warning",
        title: "Atenção",
        message,
      });

      return;
    }

    /*
     * Validação: senha
     */
    if (!validatePassword(senha)) {
      const message =
        "A senha deve ter pelo menos 8 caracteres.";

      setError(message);

      showNotification({
        type: "warning",
        title: "Atenção",
        message,
      });

      return;
    }

    setLoading(true);

    try {
      const response = await Login(
        email.trim(),
        senha,
      );

      const { usuario } = response;

      setUsuario(usuario);

      /*
       * LOGIN REALIZADO COM SUCESSO
       */
      showNotification({
        type: "success",
        title: "Entrando...",
        message: "Bem-vindo(a) ao sistema!",
      });

      navigate(
        getRoleDashboardPath(usuario?.Papel),
      );
    } catch (err) {
      let message =
        "Falha na autenticação. Verifique suas credenciais.";

      if (
        isAxiosError<{
          message?: string;
          title?: string;
        }>(err)
      ) {
        const apiMessage =
          err.response?.data?.message ||
          err.response?.data?.title;

        if (apiMessage) {
          message = apiMessage;
        }

        console.warn(
          "Erro ao fazer login:",
          err.response?.data ||
            err.message,
        );
      } else {
        console.warn(
          "Erro ao fazer login:",
          err,
        );
      }

      setError(message);

      /*
       * LOGIN NÃO REALIZADO
       */
      showNotification({
        type: "error",
        title: "Erro ao entrar",
        message,
      });
    } finally {
      setLoading(false);
    }
  }

  return {
    email,
    senha,
    showPassword,
    error,
    emailError,
    loading,

    setEmail,
    setSenha,
    setShowPassword,

    isFormValid,
    handleLogin,
  };
}
