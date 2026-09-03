import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";

import { Register } from "@/services/register-service";
import { getRoleLoginPath } from "@/routes/role-paths";

import {
  CadastroLocalizacaoError,
  useCadastroLocalizacao,
} from "@/hooks/useCadastroLocalizacao";
import { useNotification } from "@/context/NotificationContext";

import {
  listarEmpresasParaCadastro,
  type EmpresaCadastro,
} from "@/services/agenda-publica-service";

type ValidationErrorResponse =
  | string
  | {
      message?: string;
      title?: string;
      errors?: Record<string, string[]>;
    };

function getApiErrorMessage(data?: ValidationErrorResponse) {
  if (!data) {
    return "Nao foi possivel registrar. Tente novamente.";
  }

  if (typeof data === "string") {
    return data;
  }

  if (data.errors) {
    const messages = Object.entries(data.errors)
      .flatMap(([field, errors]) =>
        errors.map((error) => `${field}: ${error}`)
      )
      .join(" ");

    if (messages) {
      return messages;
    }
  }

  return (
    data.message ||
    data.title ||
    "Nao foi possivel registrar. Tente novamente."
  );
}

export function useRegisterForm() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const localizacao = useCadastroLocalizacao();
  const localizacaoModo = localizacao.modo;
  const usarLocalizacaoAtual = localizacao.usarLocalizacaoAtual;

  // Dados principais
  const [fotoPerfil, setFotoPerfil] = useState<File | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [TipoUsuario, setTipoUsuario] = useState("");

  // Dados específicos de empresa
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");

  // Localização


  // Empresas disponíveis para profissional
  const [empresas, setEmpresas] = useState<EmpresaCadastro[]>([]);
  const [empresaId, setEmpresaId] = useState(0);

  // Estados de carregamento
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const [loading, setLoading] = useState(false);

  // Interface
  const [showPassword, setShowPassword] = useState(false);

  // Erros
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");

  /*
   * Validações
   */

  const validateEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email.trim().toLowerCase()
    );

  const validatePassword = (password: string) =>
    password.length >= 8;

  const isFormValid = () => {
    const dadosBasicosValidos =
      nome.trim().length > 0 &&
      validateEmail(email) &&
      validatePassword(senha) &&
      TipoUsuario !== "" &&
      Boolean(fotoPerfil);

    if (!dadosBasicosValidos) {
      return false;
    }

    if (TipoUsuario === "profissional") {
      return localizacao.isValid && empresaId > 0;
    }

    if (TipoUsuario === "empresa") {
      return (
        nomeFantasia.trim().length > 0 &&
        cnpj.trim().length > 0
      );
    }

    return true;
  };

  /*
   * Obter localizacao para listar empresas proximas
   */
  useEffect(() => {
    if (
      TipoUsuario === "profissional" &&
      localizacaoModo === "nao-selecionada"
    ) {
      void usarLocalizacaoAtual().catch(() => undefined);
    }
  }, [
    TipoUsuario,
    localizacaoModo,
    usarLocalizacaoAtual,
  ]);

  /*
   * Carregar empresas da mesma cidade
   *
   * Executado somente quando:
   * - papel = profissional
   * - uma cidade foi selecionada
   */

  useEffect(() => {
    if (
      TipoUsuario !== "profissional" ||
      !localizacao.cidadeId
    ) {
      setEmpresas([]);
      setEmpresaId(0);
      setLoadingEmpresas(false);
      return;
    }

    let active = true;

    async function loadEmpresas() {
      try {
        setLoadingEmpresas(true);
        setError("");

        // Evita exibir empresas da cidade anterior
        setEmpresas([]);
        setEmpresaId(0);

        const data =
          await listarEmpresasParaCadastro(
            localizacao.cidadeId
          );

        if (!active) {
          return;
        }

        setEmpresas(data ?? []);
      } catch (err) {
        console.error(
          "Erro ao carregar empresas:",
          err
        );

        if (active) {
          setEmpresas([]);
          setEmpresaId(0);

          const message =
            "Nao foi possivel carregar as empresas desta cidade.";
          setError(message);
          showNotification({
            type: "error",
            title: "Empresas indisponiveis",
            message,
          });
        }
      } finally {
        if (active) {
          setLoadingEmpresas(false);
        }
      }
    }

    loadEmpresas();

    return () => {
      active = false;
    };
  }, [localizacao.cidadeId, showNotification, TipoUsuario]);

  /*
   * Submit
   */

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setError("");
    setEmailError("");

    if (
      !nome.trim() ||
      !email.trim() ||
      !senha ||
      !TipoUsuario
    ) {
      const message = "Preencha todos os campos obrigatorios.";
      setError(message);
      showNotification({ type: "warning", title: "Cadastro incompleto", message });
      return;
    }

    if (!validateEmail(email)) {
      const message = "Insira um e-mail valido.";
      setEmailError(message);
      showNotification({ type: "warning", title: "E-mail invalido", message });
      return;
    }

    if (!validatePassword(senha)) {
      const message = "A senha deve ter pelo menos 8 caracteres.";
      setError(message);
      showNotification({ type: "warning", title: "Senha invalida", message });
      return;
    }

    if (!fotoPerfil) {
      const message = "Selecione uma foto de perfil.";
      setError(message);
      showNotification({ type: "warning", title: "Foto obrigatoria", message });
      return;
    }

    /*
     * Validação específica de empresa
     */

    if (
      TipoUsuario === "empresa" &&
      (
        !nomeFantasia.trim() ||
        !cnpj.trim()
      )
    ) {
      const message = "Preencha Nome Fantasia e CNPJ para empresas.";
      setError(message);
      showNotification({ type: "warning", title: "Dados da empresa incompletos", message });
      return;
    }

    /*
     * Validação específica de profissional
     */

    if (
      TipoUsuario === "profissional" &&
      empresaId <= 0
    ) {
      const message = "Selecione uma empresa.";
      setError(message);
      showNotification({ type: "warning", title: "Empresa obrigatoria", message });
      return;
    }

    setLoading(true);

    try {
      const localizacaoPayload =
        localizacao.payload ??
        await localizacao.usarLocalizacaoAtual();

      let papelEnum:
        | "AUTONOMO"
        | "EMPRESA"
        | "PROFISSIONAL";

      switch (
        TipoUsuario
          .trim()
          .toLowerCase()
      ) {
        case "autonomo":
          papelEnum = "AUTONOMO";
          break;

        case "empresa":
          papelEnum = "EMPRESA";
          break;

        case "profissional":
          papelEnum = "PROFISSIONAL";
          break;

        default:
          throw new Error(
            "Papel invalido."
          );
      }

      await Register(
        fotoPerfil,
        nome.trim(),
        email.trim(),
        senha,
        papelEnum,
        localizacaoPayload,

        papelEnum === "EMPRESA"
          ? nomeFantasia.trim()
          : "",

        papelEnum === "EMPRESA"
          ? cnpj.trim()
          : "",

        papelEnum === "PROFISSIONAL"
          ? empresaId
          : undefined
      );

      showNotification({
        type: "success",
        title: "Cadastro concluido",
        message: papelEnum === "PROFISSIONAL"
          ? "Sua solicitacao foi enviada para a empresa selecionada."
          : "Sua conta foi criada. Agora voce ja pode entrar.",
      });

      navigate(
        getRoleLoginPath(papelEnum),
        {
          state:
            papelEnum === "PROFISSIONAL"
              ? {
                  notice:
                    "Cadastro realizado. Seu vinculo aguarda aprovacao da empresa selecionada.",
                }
              : undefined,
        }
      );
    } catch (err) {
      if (err instanceof CadastroLocalizacaoError) {
        setError(err.message);
        showNotification({
          type: "warning",
          title: "Localizacao nao identificada",
          message: err.message,
        });
      } else if (
        isAxiosError<ValidationErrorResponse>(
          err
        )
      ) {
        console.error(
          "Erro ao registrar:",
          err.response?.data
        );

        const message = getApiErrorMessage(err.response?.data);
        setError(message);
        showNotification({ type: "error", title: "Cadastro nao concluido", message });
      } else {
        console.error(
          "Erro ao registrar:",
          err
        );

        const message = "Erro ao registrar. Tente novamente.";
        setError(message);
        showNotification({ type: "error", title: "Cadastro nao concluido", message });
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    // Dados
    fotoPerfil,
    nome,
    email,
    senha,
    TipoUsuario,
    nomeFantasia,
    cnpj,

    // Localizacao
    localizacao,

    // Empresas
    empresas,
    empresaId,

    // Loading
    loadingEmpresas,
    loading,

    // Interface
    showPassword,

    // Erros
    error,
    emailError,

    // Setters
    setFotoPerfil,
    setNome,
    setEmail,
    setSenha,
    setTipoUsuario,
    setNomeFantasia,
    setCnpj,

    setEmpresaId,
    setShowPassword,

    // Funções
    isFormValid,
    handleSubmit,
  };
}
