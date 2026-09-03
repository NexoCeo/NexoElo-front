import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import {
  FaEnvelope,
  FaPen,
  FaPhoneAlt,
  FaPlus,
  FaSave,
  FaCheck,
  FaTimes,
  FaUser,
  FaUserPlus,
  FaUserClock,
  FaWhatsapp,
} from "react-icons/fa";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { useNotification } from "@/context/NotificationContext";
import {
  criarProfissionalEmpresa,
  listarProfissionaisEmpresa,
} from "@/services/profissional-service";
import {
  CadastroLocalizacaoError,
  useCadastroLocalizacao,
} from "@/hooks/useCadastroLocalizacao";
import {
  listarServicosPorEmpresa,
  listarServicosPorProfissional,
  salvarServicosDoProfissional,
} from "@/services/servico-service";
import type { Profissional } from "@/types/profissional";
import type { Servico } from "@/types/servico";
import {
  listarSolicitacoesVinculo,
  responderSolicitacaoVinculo,
  type SolicitacaoVinculo,
} from "@/services/vinculo-service";
import styles from "./style.module.css";

type ApiError =
  | string
  | {
      code?: string;
      erro?: string;
      message?: string;
      title?: string;
      errors?: Record<string, string[]>;
    };

function getApiErrorMessage(
  data?: ApiError,
  fallback = "Nao foi possivel criar o profissional.",
) {
  if (!data) {
    return fallback;
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

  return data.erro || data.message || data.title || fallback;
}

function validateEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validatePhone(value: string) {
  return value.replace(/\D/g, "").length >= 10;
}

function createWhatsAppCredentialsUrl(
  phone: string,
  professionalName: string,
  professionalEmail: string,
  temporaryPassword: string,
) {
  const digits = phone.replace(/\D/g, "");
  const phoneWithCountryCode = digits.startsWith("55") ? digits : `55${digits}`;
  const message = [
    `Olá, ${professionalName}!`,
    "",
    "Seu acesso profissional ao NexoCEO foi criado.",
    `E-mail: ${professionalEmail}`,
    `Senha temporária: ${temporaryPassword}`,
    "",
    "Por segurança, altere sua senha após o primeiro acesso.",
  ].join("\n");

  return `https://api.whatsapp.com/send?phone=${phoneWithCountryCode}&text=${encodeURIComponent(message)}`;
}

type WhatsAppShare = {
  professionalName: string;
  url: string;
};

export default function Profissionais() {
  const { theme } = useTheme();
  const { usuario } = useUser();
  const { showNotification } = useNotification();
  const localizacao = useCadastroLocalizacao();
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [whatsAppShare, setWhatsAppShare] = useState<WhatsAppShare | null>(null);

  const [fotoPerfil, setFotoPerfil] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [servicosModalOpen, setServicosModalOpen] = useState(false);
  const [profissionalEmEdicao, setProfissionalEmEdicao] = useState<Profissional | null>(null);
  const [servicosEmpresa, setServicosEmpresa] = useState<Servico[]>([]);
  const [servicoIdsSelecionados, setServicoIdsSelecionados] = useState<number[]>([]);
  const [loadingServicos, setLoadingServicos] = useState(false);
  const [savingServicos, setSavingServicos] = useState(false);
  const [servicosError, setServicosError] = useState("");
  const [solicitacoesOpen, setSolicitacoesOpen] = useState(false);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoVinculo[]>([]);
  const [loadingSolicitacoes, setLoadingSolicitacoes] = useState(false);
  const [respondendoId, setRespondendoId] = useState(0);
  const [solicitacoesError, setSolicitacoesError] = useState("");

  const empresaId = usuario?.Id ?? 0;
  const isEmpresa = usuario?.Papel === "EMPRESA";
  const canSubmit =
    nome.trim().length >= 3 &&
    validateEmail(email) &&
    validatePhone(telefone) &&
    Boolean(fotoPerfil) &&
    !saving;

  useEffect(() => {
    async function loadProfissionais() {
      if (!empresaId || !isEmpresa) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const data = await listarProfissionaisEmpresa(empresaId);
        setProfissionais(data);
      } catch {
        const message = "Nao foi possivel carregar os profissionais.";
        setError(message);
        showNotification({ type: "error", title: "Profissionais indisponiveis", message });
      } finally {
        setLoading(false);
      }
    }

    loadProfissionais();
  }, [empresaId, isEmpresa, showNotification]);

  useEffect(() => {
    if (!fotoPerfil) {
      setPreviewUrl("");
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(fotoPerfil);
    setPreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [fotoPerfil]);

  useEffect(() => {
    if (!servicosModalOpen || !profissionalEmEdicao?.Id || !empresaId) {
      return;
    }

    let active = true;

    async function loadServicos() {
      setLoadingServicos(true);
      setServicosError("");

      const [disponiveisResult, vinculadosResult] = await Promise.allSettled([
        listarServicosPorEmpresa(empresaId),
        listarServicosPorProfissional(profissionalEmEdicao!.Id, empresaId),
      ]);

      if (!active) {
        return;
      }

      const errors: string[] = [];

      if (disponiveisResult.status === "fulfilled") {
        setServicosEmpresa(disponiveisResult.value);
      } else {
        setServicosEmpresa([]);
        errors.push(
          isAxiosError<ApiError>(disponiveisResult.reason)
            ? getApiErrorMessage(
                disponiveisResult.reason.response?.data,
                "Nao foi possivel carregar os servicos da empresa.",
              )
            : "Nao foi possivel carregar os servicos da empresa.",
        );
      }

      if (vinculadosResult.status === "fulfilled") {
        setServicoIdsSelecionados(
          vinculadosResult.value.map((servico) => servico.Id),
        );
      } else {
        setServicoIdsSelecionados([]);
        errors.push(
          isAxiosError<ApiError>(vinculadosResult.reason)
            ? getApiErrorMessage(
                vinculadosResult.reason.response?.data,
                "Nao foi possivel carregar os vinculos atuais.",
              )
            : "Nao foi possivel carregar os vinculos atuais.",
        );
      }

      setServicosError(errors.join(" "));
      if (errors.length > 0) {
        showNotification({
          type: "error",
          title: "Servicos nao carregados",
          message: errors.join(" "),
        });
      }
      setLoadingServicos(false);
    }

    loadServicos();

    return () => {
      active = false;
    };
  }, [empresaId, profissionalEmEdicao, servicosModalOpen, showNotification]);

  function resetForm() {
    setFotoPerfil(null);
    setNome("");
    setEmail("");
    setTelefone("");
    localizacao.reset();
    setFormError("");
  }

  function closeModal() {
    setModalOpen(false);
    resetForm();
  }

  function openServicosModal(profissional: Profissional) {
    setProfissionalEmEdicao(profissional);
    setServicosEmpresa([]);
    setServicoIdsSelecionados([]);
    setServicosError("");
    setServicosModalOpen(true);
  }

  function closeServicosModal() {
    setServicosModalOpen(false);
    setProfissionalEmEdicao(null);
    setServicosEmpresa([]);
    setServicoIdsSelecionados([]);
    setServicosError("");
  }

  function toggleServico(servicoId: number) {
    setServicoIdsSelecionados((current) =>
      current.includes(servicoId)
        ? current.filter((id) => id !== servicoId)
        : [...current, servicoId],
    );
  }

  async function handleSaveServicos(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profissionalEmEdicao?.Id || !empresaId) {
      const message = "Profissional ou empresa invalidos.";
      setServicosError(message);
      showNotification({ type: "warning", title: "Vinculo invalido", message });
      return;
    }

    try {
      setSavingServicos(true);
      setServicosError("");
      setSuccess("");

      // O endpoint substitui a lista completa de servicos deste profissional.
      await salvarServicosDoProfissional(
        profissionalEmEdicao.Id,
        empresaId,
        servicoIdsSelecionados,
      );

      setSuccess(`Servicos de ${profissionalEmEdicao.Nome} atualizados com sucesso.`);
      showNotification({
        type: "success",
        title: "Servicos atualizados",
        message: `Os servicos de ${profissionalEmEdicao.Nome} foram salvos.`,
      });
      closeServicosModal();
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 401) {
        const message = "Sua sessao expirou. Entre novamente para salvar os servicos.";
        setServicosError(message);
        showNotification({ type: "warning", title: "Sessao expirada", message });
        return;
      }

      const message = isAxiosError<ApiError>(err)
          ? getApiErrorMessage(
              err.response?.data,
              "Nao foi possivel atualizar os servicos do profissional.",
            )
          : "Nao foi possivel atualizar os servicos do profissional.";
      setServicosError(message);
      showNotification({ type: "error", title: "Servicos nao atualizados", message });
    } finally {
      setSavingServicos(false);
    }
  }

  async function refreshProfissionais(created?: Profissional) {
    const data = await listarProfissionaisEmpresa(empresaId).catch(() => []);

    if (!created || data.some((profissional) => profissional.Id === created.Id)) {
      setProfissionais(data);
      return;
    }

    setProfissionais([...data, created]);
  }

  async function openSolicitacoesModal() {
    setSolicitacoesOpen(true);
    setLoadingSolicitacoes(true);
    setSolicitacoesError("");
    try {
      setSolicitacoes(await listarSolicitacoesVinculo(empresaId));
    } catch {
      const message = "Nao foi possivel carregar as solicitacoes pendentes.";
      setSolicitacoesError(message);
      showNotification({ type: "error", title: "Solicitacoes indisponiveis", message });
    } finally {
      setLoadingSolicitacoes(false);
    }
  }

  async function responderSolicitacao(
    solicitacao: SolicitacaoVinculo,
    status: "APROVADO" | "RECUSADO",
  ) {
    try {
      setRespondendoId(solicitacao.VinculoId);
      setSolicitacoesError("");
      await responderSolicitacaoVinculo(empresaId, solicitacao.VinculoId, status);
      setSolicitacoes((items) =>
        items.filter((item) => item.VinculoId !== solicitacao.VinculoId),
      );
      if (status === "APROVADO") await refreshProfissionais();
      setSuccess(
        status === "APROVADO"
          ? `${solicitacao.Nome} foi vinculado a empresa.`
          : `Solicitacao de ${solicitacao.Nome} recusada.`,
      );
      showNotification({
        type: "success",
        title: status === "APROVADO" ? "Vinculo aprovado" : "Solicitacao recusada",
        message: status === "APROVADO"
          ? `${solicitacao.Nome} agora faz parte da empresa.`
          : `A solicitacao de ${solicitacao.Nome} foi recusada.`,
      });
    } catch (err) {
      const message = isAxiosError<ApiError>(err)
          ? getApiErrorMessage(err.response?.data, "Nao foi possivel responder a solicitacao.")
          : "Nao foi possivel responder a solicitacao.";
      setSolicitacoesError(message);
      showNotification({ type: "error", title: "Solicitacao nao respondida", message });
    } finally {
      setRespondendoId(0);
    }
  }

  async function handleCreateProfissional(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccess("");

    if (!empresaId || !isEmpresa) {
      const message = "Apenas empresas podem criar profissionais.";
      setFormError(message);
      showNotification({ type: "warning", title: "Acao nao permitida", message });
      return;
    }

    if (nome.trim().length < 3) {
      const message = "Informe o nome do profissional.";
      setFormError(message);
      showNotification({ type: "warning", title: "Nome incompleto", message });
      return;
    }

    if (!validateEmail(email)) {
      const message = "Informe um e-mail valido.";
      setFormError(message);
      showNotification({ type: "warning", title: "E-mail invalido", message });
      return;
    }

    if (!validatePhone(telefone)) {
      const message = "Informe um telefone valido.";
      setFormError(message);
      showNotification({ type: "warning", title: "Telefone invalido", message });
      return;
    }

    if (!fotoPerfil) {
      const message = "Selecione uma foto de perfil.";
      setFormError(message);
      showNotification({ type: "warning", title: "Foto obrigatoria", message });
      return;
    }

    try {
      setSaving(true);
      const localizacaoPayload =
        localizacao.payload ?? await localizacao.usarLocalizacaoAtual();

      const access = await criarProfissionalEmpresa({
        empresaId,
        nome,
        email,
        telefone,
        fotoPerfil,
        localizacao: localizacaoPayload,
      });
      await refreshProfissionais(access.profissional);
      setSuccess("Profissional criado com sucesso.");

      const accessEmail = access.profissional.Email || email.trim();
      const accessPhone = access.profissional.Telefone || telefone;
      const accessName = access.profissional.Nome || nome.trim();

      if (!access.senhaTemporaria) {
        showNotification({
          type: "warning",
          title: "Profissional criado",
          message: "O cadastro foi concluído, mas a senha temporária não foi retornada.",
        });
        closeModal();
        return;
      }

      setWhatsAppShare({
        professionalName: accessName,
        url: createWhatsAppCredentialsUrl(
          accessPhone,
          accessName,
          accessEmail,
          access.senhaTemporaria,
        ),
      });
      showNotification({
        type: "success",
        title: "Profissional criado",
        message: "O acesso foi criado. Compartilhe as credenciais pelo WhatsApp.",
      });
      closeModal();
    } catch (err) {
      if (err instanceof CadastroLocalizacaoError) {
        setFormError(err.message);
        showNotification({
          type: "warning",
          title: "Localizacao nao identificada",
          message: err.message,
        });
      } else if (isAxiosError<ApiError>(err)) {
        const message = getApiErrorMessage(err.response?.data);
        setFormError(message);
        showNotification({ type: "error", title: "Profissional nao criado", message });
      } else {
        const message = "Nao foi possivel criar o profissional.";
        setFormError(message);
        showNotification({ type: "error", title: "Profissional nao criado", message });
      }
    } finally {
      setSaving(false);
    }
  }

  if (!isEmpresa) {
    return (
      <main className={styles.container} style={{ backgroundColor: theme.colors.background }}>
        <section className={styles.header}>
          <h1 style={{ color: theme.colors.text }}>Profissionais</h1>
          <p style={{ color: theme.colors.inactive }}>
            Apenas empresas podem gerenciar profissionais vinculados.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.container} style={{ backgroundColor: theme.colors.background }}>
      <section className={styles.header}>
        <div>
          <h1 style={{ color: theme.colors.text }}>Profissionais</h1>
          <p style={{ color: theme.colors.inactive }}>
            Gerencie os profissionais vinculados a esta empresa.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryHeaderButton}
            onClick={openSolicitacoesModal}
          >
            <FaUserClock />
            Solicitacoes de vinculo
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => setModalOpen(true)}
            style={{ backgroundColor: theme.colors.primary, color: theme.colors.onPrimary }}
          >
            <FaUserPlus />
            Novo profissional
          </button>
        </div>
      </section>

      {success && <p className={styles.success}>{success}</p>}
      {error && <p className={styles.error}>{error}</p>}

      <section className={styles.tableWrap} style={{ backgroundColor: theme.colors.background2 }}>
        {loading ? (
          <p className={styles.feedback} style={{ color: theme.colors.text }}>
            Carregando profissionais...
          </p>
        ) : profissionais.length === 0 ? (
          <p className={styles.feedback} style={{ color: theme.colors.inactive }}>
            Nenhum profissional vinculado ainda.
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Profissional</th>
                <th>Email</th>
                <th>Telefone</th>
                <th>Status</th>
                <th className={styles.actionsHeader}>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {profissionais.map((profissional) => (
                <tr key={profissional.Id || profissional.Email || profissional.Nome}>
                  <td data-label="Profissional">
                    <strong style={{ color: theme.colors.text }}>
                      {profissional.Nome || "Sem nome"}
                    </strong>
                  </td>
                  <td data-label="Email">{profissional.Email || "Nao informado"}</td>
                  <td data-label="Telefone">{profissional.Telefone || "Nao informado"}</td>
                  <td data-label="Status">
                    <span className={styles.status}>
                      {profissional.VinculoStatus || "Vinculado"}
                    </span>
                  </td>
                  <td className={styles.actionsCell} data-label="Acoes">
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => openServicosModal(profissional)}
                      aria-label={`Editar servicos de ${profissional.Nome}`}
                      title={`Editar servicos de ${profissional.Nome}`}
                      style={{ color: theme.colors.primary }}
                    >
                      <FaPen />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {modalOpen && (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.modal} style={{ backgroundColor: theme.colors.background2 }}>
            <header className={styles.modalHeader}>
              <div>
                <h2 style={{ color: theme.colors.text }}>Novo profissional</h2>
                <p style={{ color: theme.colors.inactive }}>
                  Cadastre o acesso do profissional e vincule a esta empresa.
                </p>
              </div>
              <button type="button" onClick={closeModal} aria-label="Fechar modal">
                <FaTimes />
              </button>
            </header>

            <form className={styles.form} onSubmit={handleCreateProfissional}>
              <label className={styles.photoField}>
                Foto de perfil
                <span className={styles.photoControl}>
                  <span className={styles.photoPreview}>
                    {previewUrl ? <img src={previewUrl} alt="Foto selecionada" /> : <FaPlus />}
                  </span>
                  <strong>{fotoPerfil ? fotoPerfil.name : "Selecionar foto"}</strong>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setFotoPerfil(event.target.files?.[0] ?? null)}
                  />
                </span>
              </label>

              <label>
                Nome
                <div className={styles.inputWrap}>
                  <input
                    type="text"
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                    placeholder="Nome do profissional"
                  />
                  <FaUser />
                </div>
              </label>

              <label>
                Email
                <div className={styles.inputWrap}>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="email@exemplo.com"
                  />
                  <FaEnvelope />
                </div>
              </label>

              <label>
                Telefone
                <div className={styles.inputWrap}>
                  <input
                    type="tel"
                    value={telefone}
                    onChange={(event) => setTelefone(event.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                  <FaPhoneAlt />
                </div>
              </label>

              {formError && <p className={styles.error}>{formError}</p>}

              <button
                className={styles.submitButton}
                type="submit"
                disabled={!canSubmit}
                style={{ backgroundColor: theme.colors.primary, color: theme.colors.onPrimary }}
              >
                {saving ? "Criando..." : "Criar profissional"}
              </button>
            </form>
          </section>
        </div>
      )}

      {whatsAppShare && (
        <div className={styles.modalBackdrop} role="presentation">
          <section
            className={`${styles.modal} ${styles.whatsappModal}`}
            style={{ backgroundColor: theme.colors.background2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="whatsapp-access-title"
          >
            <header className={styles.modalHeader}>
              <div>
                <h2 id="whatsapp-access-title" style={{ color: theme.colors.text }}>
                  Acesso criado
                </h2>
                <p style={{ color: theme.colors.inactive }}>
                  Compartilhe as credenciais com {whatsAppShare.professionalName}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWhatsAppShare(null)}
                aria-label="Fechar compartilhamento"
              >
                <FaTimes />
              </button>
            </header>

            <p className={styles.whatsappMessage}>
              O WhatsApp abrirá com a mensagem preenchida. Revise os dados e toque em enviar.
            </p>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setWhatsAppShare(null)}
              >
                Agora não
              </button>
              <a
                className={styles.whatsappButton}
                href={whatsAppShare.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setWhatsAppShare(null)}
              >
                <FaWhatsapp />
                Enviar pelo WhatsApp
              </a>
            </div>
          </section>
        </div>
      )}

      {solicitacoesOpen && (
        <div className={styles.modalBackdrop} role="presentation">
          <section
            className={`${styles.modal} ${styles.requestsModal}`}
            style={{ backgroundColor: theme.colors.background2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="solicitacoes-title"
          >
            <header className={styles.modalHeader}>
              <div>
                <h2 id="solicitacoes-title" style={{ color: theme.colors.text }}>
                  Solicitacoes de vinculo
                </h2>
                <p style={{ color: theme.colors.inactive }}>
                  Profissionais que escolheram esta empresa no cadastro.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSolicitacoesOpen(false)}
                aria-label="Fechar solicitacoes"
              >
                <FaTimes />
              </button>
            </header>

            {loadingSolicitacoes ? (
              <p className={styles.servicesFeedback}>Carregando solicitacoes...</p>
            ) : solicitacoes.length === 0 ? (
              <p className={styles.servicesFeedback}>Nenhuma solicitacao pendente.</p>
            ) : (
              <div className={styles.requestsList}>
                {solicitacoes.map((solicitacao) => (
                  <article className={styles.requestItem} key={solicitacao.VinculoId}>
                    <div>
                      <strong>{solicitacao.Nome}</strong>
                      <span>{solicitacao.Email || solicitacao.Telefone || "Contato nao informado"}</span>
                    </div>
                    <div className={styles.requestActions}>
                      <button
                        type="button"
                        className={styles.rejectButton}
                        onClick={() => responderSolicitacao(solicitacao, "RECUSADO")}
                        disabled={Boolean(respondendoId)}
                        aria-label={`Recusar vinculo de ${solicitacao.Nome}`}
                        title="Recusar"
                      >
                        <FaTimes />
                      </button>
                      <button
                        type="button"
                        className={styles.approveButton}
                        onClick={() => responderSolicitacao(solicitacao, "APROVADO")}
                        disabled={Boolean(respondendoId)}
                        aria-label={`Aprovar vinculo de ${solicitacao.Nome}`}
                        title="Aprovar"
                      >
                        <FaCheck />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {solicitacoesError && <p className={styles.error}>{solicitacoesError}</p>}
          </section>
        </div>
      )}

      {servicosModalOpen && profissionalEmEdicao && (
        <div className={styles.modalBackdrop} role="presentation">
          <section
            className={`${styles.modal} ${styles.servicesModal}`}
            style={{ backgroundColor: theme.colors.background2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="servicos-profissional-title"
          >
            <header className={styles.modalHeader}>
              <div>
                <h2 id="servicos-profissional-title" style={{ color: theme.colors.text }}>
                  Servicos de {profissionalEmEdicao.Nome}
                </h2>
                <p style={{ color: theme.colors.inactive }}>
                  Servicos oferecidos por este profissional.
                </p>
              </div>
              <button
                type="button"
                onClick={closeServicosModal}
                aria-label="Fechar modal de servicos"
                title="Fechar"
              >
                <FaTimes />
              </button>
            </header>

            <form className={styles.servicesForm} onSubmit={handleSaveServicos}>
              <div className={styles.servicesSummary}>
                <span>Servicos da empresa</span>
                <strong>{servicoIdsSelecionados.length} selecionado(s)</strong>
              </div>

              {loadingServicos ? (
                <p className={styles.servicesFeedback}>Carregando servicos...</p>
              ) : servicosEmpresa.length === 0 ? (
                <p className={styles.servicesFeedback}>
                  Nenhum servico cadastrado para esta empresa.
                </p>
              ) : (
                <div className={styles.servicesList}>
                  {servicosEmpresa.map((servico) => {
                    const selecionado = servicoIdsSelecionados.includes(servico.Id);

                    return (
                      <label
                        key={servico.Id}
                        className={`${styles.serviceOption} ${
                          selecionado ? styles.serviceOptionSelected : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selecionado}
                          onChange={() => toggleServico(servico.Id)}
                        />
                        <span>
                          <strong>{servico.NomeServico}</strong>
                          <small>{servico.TempoEstimadoMinutos} min</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {servicosError && <p className={styles.error}>{servicosError}</p>}

              <footer className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={closeServicosModal}
                  disabled={savingServicos}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`${styles.submitButton} ${styles.servicesSaveButton}`}
                  disabled={loadingServicos || savingServicos || Boolean(servicosError)}
                  style={{ backgroundColor: theme.colors.primary, color: theme.colors.onPrimary }}
                >
                  <FaSave />
                  {savingServicos ? "Salvando..." : "Salvar servicos"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
