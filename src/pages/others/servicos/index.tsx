import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaEllipsisV, FaImage, FaPen, FaPlus, FaTimes } from "react-icons/fa";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { useNotification } from "@/context/NotificationContext";
import {
  atualizarServico,
  inserirServico,
  listarServicosPorEmpresa,
} from "@/services/servico-service";
import type { Servico } from "@/types/servico";
import { getUploadedImageUrl } from "@/components/header/profile-image";
import styles from "./style.module.css";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function Servicos() {
  const { theme } = useTheme();
  const { usuario } = useUser();
  const { showNotification } = useNotification();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [nomeServico, setNomeServico] = useState("");
  const [valor, setValor] = useState("");
  const [tempoEstimadoMinutos, setTempoEstimadoMinutos] = useState("30");
  const [imagemServico, setImagemServico] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<Servico | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [imagemPreviewUrl, setImagemPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);

  const ownerId = usuario?.Id ?? 0;
  const isEmpresa = usuario?.Papel === "EMPRESA";
  const isAutonomo = usuario?.Papel === "AUTONOMO";

  const valorNumber = useMemo(() => {
    const normalizedValue = valor.replace(/\./g, "").replace(",", ".");
    return Number(normalizedValue);
  }, [valor]);

  const canSubmit =
    nomeServico.trim().length > 0 &&
    valorNumber > 0 &&
    Number(tempoEstimadoMinutos) > 0 &&
    !saving;

  const fetchServicos = useCallback(async () => {
    if (!ownerId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const data = await listarServicosPorEmpresa(ownerId);
      setServicos(data);
    } catch {
      const message = "Nao foi possivel carregar os servicos.";
      setError(message);
      showNotification({ type: "error", title: "Servicos indisponiveis", message });
    } finally {
      setLoading(false);
    }
  }, [ownerId, showNotification]);

  useEffect(() => {
    void fetchServicos();
  }, [fetchServicos]);

  useEffect(() => {
    if (!imagemServico) {
      setImagemPreviewUrl(getUploadedImageUrl(editingServico?.ImagemServico));
      return;
    }

    if (typeof URL.createObjectURL !== "function") {
      setImagemPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(imagemServico);
    setImagemPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [editingServico?.ImagemServico, imagemServico]);

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuId(null);
        setModalOpen(false);
        setImagemServico(null);
        setEditingServico(null);
      }
    }

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function resetForm() {
    setNomeServico("");
    setValor("");
    setTempoEstimadoMinutos("30");
    setImagemServico(null);
    setEditingServico(null);
    setFormError("");
  }

  function openCreateModal() {
    resetForm();
    setSuccess("");
    setFormError("");
    setModalOpen(true);
  }

  function openEditModal(servico: Servico) {
    setEditingServico(servico);
    setNomeServico(servico.NomeServico);
    setValor(String(servico.Valor).replace(".", ","));
    setTempoEstimadoMinutos(String(servico.TempoEstimadoMinutos));
    setImagemServico(null);
    setSuccess("");
    setFormError("");
    setOpenMenuId(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    resetForm();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccess("");

    if (!nomeServico.trim()) {
      const message = "Informe o nome do servico.";
      setFormError(message);
      showNotification({ type: "warning", title: "Nome obrigatorio", message });
      return;
    }

    if (!valorNumber || Number.isNaN(valorNumber) || valorNumber <= 0) {
      const message = "Informe um valor valido.";
      setFormError(message);
      showNotification({ type: "warning", title: "Valor invalido", message });
      return;
    }

    const tempoEstimadoNumber = Number(tempoEstimadoMinutos);

    if (!tempoEstimadoNumber || Number.isNaN(tempoEstimadoNumber) || tempoEstimadoNumber <= 0) {
      const message = "Informe o tempo estimado do servico.";
      setFormError(message);
      showNotification({ type: "warning", title: "Duracao invalida", message });
      return;
    }

    if (!ownerId || (!isEmpresa && !isAutonomo)) {
      const message = "Apenas empresa ou autonomo podem cadastrar servicos.";
      setFormError(message);
      showNotification({ type: "warning", title: "Acao nao permitida", message });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        NomeServico: nomeServico.trim(),
        Valor: valorNumber,
        TempoEstimadoMinutos: tempoEstimadoNumber,
        ImagemServico: imagemServico,
      };

      if (editingServico) {
        const atualizado = await atualizarServico(editingServico.Id, payload);
        setServicos((current) => current.map((servico) => (
          servico.Id === atualizado.Id ? atualizado : servico
        )));
        setSuccess("Servico atualizado com sucesso.");
        showNotification({
          type: "success",
          title: "Servico atualizado",
          message: "As alteracoes ja estao disponiveis no agendamento.",
        });
      } else {
        const criado = await inserirServico({
          UsuarioFk: ownerId,
          EmpresaId: isEmpresa ? ownerId : null,
          ProfissionalId: isAutonomo ? ownerId : null,
          ...payload,
        });
        setServicos((current) => [...current, criado]);
        setSuccess("Servico cadastrado com sucesso.");
        showNotification({
          type: "success",
          title: "Servico cadastrado",
          message: "O novo servico foi adicionado a sua lista.",
        });
      }

      closeModal();
    } catch {
      const message = "Nao foi possivel salvar o servico.";
      setFormError(message);
      showNotification({ type: "error", title: "Servico nao salvo", message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.container} style={{ backgroundColor: theme.colors.background }}>
      <section className={styles.header}>
        <div>
          <h1 style={{ color: theme.colors.text }}>Servicos</h1>
          <p style={{ color: theme.colors.inactive }}>
            Gerencie os servicos disponiveis para agendamento.
          </p>
        </div>

        <button
          type="button"
          className={styles.primaryButton}
          onClick={openCreateModal}
          style={{ backgroundColor: theme.colors.primary, color: theme.colors.onPrimary }}
        >
          <FaPlus aria-hidden="true" />
          Novo servico
        </button>
      </section>

      {success && <p className={styles.success}>{success}</p>}
      {error && <p className={styles.error}>{error}</p>}

      <section className={styles.tableWrap} style={{ backgroundColor: theme.colors.background2 }}>
        {loading ? (
          <p className={styles.feedback} style={{ color: theme.colors.text }}>
            Carregando servicos...
          </p>
        ) : servicos.length === 0 ? (
          <p className={styles.feedback} style={{ color: theme.colors.inactive }}>
            Nenhum servico cadastrado ainda.
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Servico</th>
                <th>Codigo</th>
                <th>Duracao</th>
                <th className={styles.valueHeader}>Valor</th>
                <th className={styles.actionsHeader}>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {servicos.map((servico) => (
                <tr key={servico.Id || servico.NomeServico}>
                  <td data-label="Servico">
                    <div className={styles.serviceIdentity}>
                      <span className={styles.serviceThumbnail} aria-hidden="true">
                        <FaImage />
                        {getUploadedImageUrl(servico.ImagemServico) && (
                          <img
                            src={getUploadedImageUrl(servico.ImagemServico)}
                            alt=""
                            onError={(event) => event.currentTarget.remove()}
                          />
                        )}
                      </span>
                      <strong style={{ color: theme.colors.text }}>
                        {servico.NomeServico || "Sem nome"}
                      </strong>
                    </div>
                  </td>
                  <td data-label="Codigo">{servico.Id || "Novo"}</td>
                  <td data-label="Duracao">{servico.TempoEstimadoMinutos || 0} min</td>
                  <td className={styles.valueCell} data-label="Valor">
                    <strong style={{ color: theme.colors.primary }}>
                      {formatCurrency(servico.Valor)}
                    </strong>
                  </td>
                  <td className={styles.actionsCell} data-label="Acoes">
                    <div
                      className={styles.actionsMenu}
                      ref={openMenuId === servico.Id ? menuRef : undefined}
                    >
                      <button
                        type="button"
                        className={styles.menuTrigger}
                        aria-label={`Opcoes de ${servico.NomeServico}`}
                        aria-haspopup="menu"
                        aria-expanded={openMenuId === servico.Id}
                        onClick={() => setOpenMenuId((current) => (
                          current === servico.Id ? null : servico.Id
                        ))}
                      >
                        <FaEllipsisV aria-hidden="true" />
                      </button>
                      {openMenuId === servico.Id && (
                        <div className={styles.menuPopover} role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => openEditModal(servico)}
                          >
                            <FaPen aria-hidden="true" />
                            Editar
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {modalOpen && (
        <div className={styles.modalBackdrop} role="presentation">
          <section
            className={styles.modal}
            style={{ backgroundColor: theme.colors.background2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="servico-modal-title"
          >
            <header className={styles.modalHeader}>
              <div>
                <h2 id="servico-modal-title" style={{ color: theme.colors.text }}>
                  {editingServico ? "Editar servico" : "Novo servico"}
                </h2>
                <p style={{ color: theme.colors.inactive }}>
                  {editingServico
                    ? "Atualize as informacoes exibidas no agendamento."
                    : "Cadastre um servico disponivel para agendamento."}
                </p>
              </div>
              <button type="button" onClick={closeModal} aria-label="Fechar modal" title="Fechar">
                <FaTimes aria-hidden="true" />
              </button>
            </header>

            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.imageField}>
                Imagem do servico
                <span className={styles.imageControl}>
                  <span className={styles.imagePreview} aria-hidden="true">
                    <FaImage />
                    {imagemPreviewUrl && <img src={imagemPreviewUrl} alt="" />}
                  </span>
                  <span>{imagemServico?.name || "Selecionar imagem"}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    aria-label="Imagem do servico"
                    onChange={(event) => setImagemServico(event.target.files?.[0] ?? null)}
                  />
                </span>
              </label>

              <label>
                Nome do servico
                <input
                  type="text"
                  value={nomeServico}
                  onChange={(event) => setNomeServico(event.target.value)}
                  placeholder="Ex: Corte masculino"
                  autoFocus
                />
              </label>

              <label>
                Valor
                <input
                  type="text"
                  inputMode="decimal"
                  value={valor}
                  onChange={(event) => setValor(event.target.value)}
                  placeholder="Ex: 45,00"
                />
              </label>

              <div className={styles.fieldGroup}>
                <label htmlFor="service-duration">Tempo estimado</label>
                <div className={styles.durationField}>
                  <input
                    id="service-duration"
                    type="number"
                    min="5"
                    step="5"
                    value={tempoEstimadoMinutos}
                    onChange={(event) => setTempoEstimadoMinutos(event.target.value)}
                    aria-label="Tempo estimado"
                    aria-describedby="duration-unit"
                  />
                  <span id="duration-unit">min</span>
                </div>
              </div>

              {formError && <p className={styles.formError}>{formError}</p>}

              <button
                className={styles.submitButton}
                type="submit"
                disabled={!canSubmit}
                style={{ backgroundColor: theme.colors.primary, color: theme.colors.onPrimary }}
              >
                {saving
                  ? "Salvando..."
                  : editingServico ? "Salvar alteracoes" : "Criar servico"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
