import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { registerClienteFinal } from "@/services/cliente-final-auth-service";
import {
  CadastroLocalizacaoError,
  useCadastroLocalizacao,
} from "@/hooks/useCadastroLocalizacao";
import { useNotification } from "@/context/NotificationContext";

type ValidationErrorResponse = string | {
  message?: string;
  title?: string;
  errors?: Record<string, string[]>;
};

function getApiErrorMessage(data?: ValidationErrorResponse) {
  if (!data) {
    return "Nao foi possivel criar a conta.";
  }

  if (typeof data === "string") {
    return data;
  }

  if (data.errors) {
    const messages = Object.entries(data.errors)
      .flatMap(([field, errors]) => errors.map((error) => `${field}: ${error}`))
      .join(" ");

    if (messages) {
      return messages;
    }
  }

  return data.message || data.title || "Nao foi possivel criar a conta.";
}

export function useClienteFinalRegisterForm() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [searchParams] = useSearchParams();
  const localizacao = useCadastroLocalizacao();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [fotoPerfil, setFotoPerfil] = useState<File | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  const validatePhone = (value: string) => value.replace(/\D/g, "").length >= 10;
  const validatePassword = (value: string) => value.length >= 8;
  const redirectTo = searchParams.get("redirectTo");
  const safeRedirectTo = redirectTo?.startsWith("/cliente-final/") ? redirectTo : "";

  const isFormValid = () =>
    nome.trim().length >= 3 &&
    validateEmail(email) &&
    validatePhone(telefone) &&
    validatePassword(senha) &&
    senha === confirmarSenha &&
    Boolean(fotoPerfil);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (nome.trim().length < 3) {
      const message = "Informe seu nome completo.";
      setError(message);
      showNotification({ type: "warning", title: "Nome incompleto", message });
      return;
    }

    if (!validateEmail(email)) {
      const message = "Informe um e-mail valido.";
      setError(message);
      showNotification({ type: "warning", title: "E-mail invalido", message });
      return;
    }

    if (!validatePhone(telefone)) {
      const message = "Informe um telefone valido.";
      setError(message);
      showNotification({ type: "warning", title: "Telefone invalido", message });
      return;
    }

    if (!validatePassword(senha)) {
      const message = "A senha deve ter pelo menos 8 caracteres.";
      setError(message);
      showNotification({ type: "warning", title: "Senha invalida", message });
      return;
    }

    if (senha !== confirmarSenha) {
      const message = "As senhas nao coincidem.";
      setError(message);
      showNotification({ type: "warning", title: "Revise as senhas", message });
      return;
    }

    if (!fotoPerfil) {
      const message = "Selecione uma foto de perfil.";
      setError(message);
      showNotification({ type: "warning", title: "Foto obrigatoria", message });
      return;
    }

    try {
      setLoading(true);
      const localizacaoPayload =
        localizacao.payload ?? await localizacao.usarLocalizacaoAtual();

      await registerClienteFinal({
        nome,
        email,
        telefone,
        senha,
        fotoPerfil,
        localizacao: localizacaoPayload,
      });
      showNotification({
        type: "success",
        title: "Conta criada",
        message: "Cadastro concluido. Entre para continuar.",
      });
      const loginPath = safeRedirectTo
        ? `/cliente-final/login?redirectTo=${encodeURIComponent(safeRedirectTo)}`
        : "/cliente-final/login";
      navigate(loginPath);
    } catch (err) {
      if (err instanceof CadastroLocalizacaoError) {
        setError(err.message);
        showNotification({
          type: "warning",
          title: "Localizacao nao identificada",
          message: err.message,
        });
      } else if (isAxiosError<ValidationErrorResponse>(err)) {
        console.warn("Erro ao criar cliente final:", err.response?.data || err.message);
        const message = getApiErrorMessage(err.response?.data);
        setError(message);
        showNotification({ type: "error", title: "Conta nao criada", message });
      } else {
        const message = "Nao foi possivel criar a conta.";
        setError(message);
        showNotification({ type: "error", title: "Conta nao criada", message });
      }
    } finally {
      setLoading(false);
    }
  }

  return {
    nome,
    email,
    telefone,
    senha,
    confirmarSenha,
    fotoPerfil,
    localizacao,
    showPassword,
    error,
    loading,
    redirectTo: safeRedirectTo,
    setNome,
    setEmail,
    setTelefone,
    setSenha,
    setConfirmarSenha,
    setFotoPerfil,
    setShowPassword,
    isFormValid,
    handleSubmit,
  };
}
