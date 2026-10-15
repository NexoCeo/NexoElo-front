import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  FaCamera,
  FaEnvelope,
  FaPen,
  FaPhone,
  FaSave,
  FaTimes,
  FaUser,
} from "react-icons/fa";
import { getProfileImageUrl } from "@/components/header/profile-image";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { useNotification } from "@/context/NotificationContext";
import {
  atualizarPerfilUsuario,
  obterPerfilUsuario,
} from "@/services/usuario-service";
import styles from "./style.module.css";
import ProfileOverview from "@/components/profile-overview";
import LoadingState from "@/components/loading-state";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatRole(role?: string) {
  const labels: Record<string, string> = {
    EMPRESA: "Empresa",
    AUTONOMO: "Autonomo",
    PROFISSIONAL: "Profissional",
  };

  return labels[role?.toUpperCase() ?? ""] ?? "Usuario";
}

export default function Perfil() {
  const { theme } = useTheme();
  const { usuario, setUsuario } = useUser();
  const { showNotification } = useNotification();
  const [modalOpen, setModalOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [fotoPerfil, setFotoPerfil] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const userId = usuario?.Id ?? 0;
  const telefoneDigits = useMemo(
    () => telefone.replace(/\D/g, ""),
    [telefone],
  );
  const canSubmit =
    nome.trim().length > 0 &&
    emailPattern.test(email.trim()) &&
    (!telefoneDigits || (telefoneDigits.length >= 10 && telefoneDigits.length <= 11)) &&
    !saving;

  useEffect(() => {
    if (!userId) return;

    let active = true;
    async function loadProfile() {
      try {
        setLoading(true);
        const profile = await obterPerfilUsuario(userId);
        if (active) setUsuario(profile);
      } catch {
        if (active) {
          const message = "Nao foi possivel atualizar os dados do perfil.";
          setError(message);
          showNotification({ type: "error", title: "Perfil indisponivel", message });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [setUsuario, showNotification, userId]);

  useEffect(() => {
    if (!fotoPerfil) {
      setFotoPreview(getProfileImageUrl(usuario?.FotoPerfil));
      return;
    }

    if (typeof URL.createObjectURL !== "function") {
      setFotoPreview(getProfileImageUrl(usuario?.FotoPerfil));
      return;
    }

    const objectUrl = URL.createObjectURL(fotoPerfil);
    setFotoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [fotoPerfil, usuario?.FotoPerfil]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setModalOpen(false);
        setFotoPerfil(null);
        setError("");
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  function openModal() {
    setNome(usuario?.Nome ?? "");
    setEmail(usuario?.Email ?? "");
    setTelefone(usuario?.Telefone ?? "");
    setFotoPerfil(null);
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setFotoPerfil(null);
    setError("");
  }

  async function handlePhotoChange(file: File) {
    if (!usuario || photoSaving) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024) {
      showNotification({ type: "warning", title: "Foto inválida", message: "Use JPG, PNG ou WEBP com até 5 MB." });
      return;
    }
    try {
      setPhotoSaving(true);
      const updated = await atualizarPerfilUsuario(usuario.Id, {
        Nome: usuario.Nome,
        Email: usuario.Email,
        Telefone: usuario.Telefone,
        FotoPerfil: file,
      });
      setUsuario({
        ...usuario,
        ...updated,
        Papel: updated.Papel || usuario.Papel,
        Slug: updated.Slug || usuario.Slug,
        UrlPublica: updated.UrlPublica || usuario.UrlPublica,
      });
      showNotification({ type: "success", title: "Foto atualizada", message: "Sua foto de perfil foi alterada." });
    } catch {
      showNotification({ type: "error", title: "Falha no envio", message: "Não foi possível atualizar sua foto. Tente novamente." });
    } finally {
      setPhotoSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!canSubmit || !usuario) {
      const message = "Revise os dados informados.";
      setError(message);
      showNotification({ type: "warning", title: "Dados invalidos", message });
      return;
    }

    try {
      setSaving(true);
      const updated = await atualizarPerfilUsuario(usuario.Id, {
        Nome: nome.trim(),
        Email: email.trim(),
        Telefone: telefoneDigits,
        FotoPerfil: fotoPerfil,
      });

      setUsuario({
        ...usuario,
        ...updated,
        Papel: updated.Papel || usuario.Papel,
        Slug: updated.Slug || usuario.Slug,
        UrlPublica: updated.UrlPublica || usuario.UrlPublica,
      });
      setSuccess("Perfil atualizado com sucesso.");
      showNotification({
        type: "success",
        title: "Perfil atualizado",
        message: "Seus novos dados ja estao visiveis no sistema.",
      });
      closeModal();
    } catch {
      const message = "Nao foi possivel salvar as alteracoes do perfil.";
      setError(message);
      showNotification({ type: "error", title: "Perfil nao salvo", message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.container} style={{ backgroundColor: theme.colors.background }}>
      {success && <p className={styles.success}>{success}</p>}
      {error && !modalOpen && <p className={styles.error}>{error}</p>}

      <div className={styles.profileShell}>
        {!usuario && loading ? <LoadingState label="Carregando perfil" /> : <ProfileOverview
          role={formatRole(usuario?.Papel)}
          name={usuario?.Nome || "Nome não informado"}
          email={usuario?.Email}
          phone={usuario?.Telefone}
          avatarUrl={getProfileImageUrl(usuario?.FotoPerfil)}
          onPhotoChange={usuario && !loading ? (file) => void handlePhotoChange(file) : undefined}
          photoSaving={photoSaving}
          action={<button
          type="button"
          className={styles.editButton}
          onClick={openModal}
          disabled={!usuario || loading}
          style={{ backgroundColor: theme.colors.primary, color: theme.colors.onPrimary }}
        >
          <FaPen aria-hidden="true" />
          Editar perfil
        </button>}
        />}
      </div>

      {modalOpen && (
        <div className={styles.modalBackdrop} role="presentation">
          <section
            className={styles.modal}
            style={{ backgroundColor: theme.colors.background2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="editar-perfil-title"
          >
            <header className={styles.modalHeader}>
              <div>
                <h2 id="editar-perfil-title" style={{ color: theme.colors.text }}>
                  Editar perfil
                </h2>
                <p style={{ color: theme.colors.inactive }}>
                  As alteracoes aparecem no sistema assim que forem salvas.
                </p>
              </div>
              <button type="button" onClick={closeModal} aria-label="Fechar modal" title="Fechar">
                <FaTimes aria-hidden="true" />
              </button>
            </header>

            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.photoField}>
                Foto de perfil
                <span className={styles.photoControl}>
                  <span className={styles.photoPreview}>
                    <img src={fotoPreview} alt="Previa da foto de perfil" />
                  </span>
                  <span>
                    <strong>{fotoPerfil?.name || "Escolher nova foto"}</strong>
                    <small>JPG, PNG ou WEBP, ate 5 MB</small>
                  </span>
                  <FaCamera aria-hidden="true" />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    aria-label="Foto de perfil"
                    onChange={(event) => setFotoPerfil(event.target.files?.[0] ?? null)}
                  />
                </span>
              </label>

              <label>
                Nome
                <span className={styles.inputWrap}>
                  <input
                    type="text"
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                    autoFocus
                  />
                  <FaUser aria-hidden="true" />
                </span>
              </label>

              <label>
                E-mail
                <span className={styles.inputWrap}>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <FaEnvelope aria-hidden="true" />
                </span>
              </label>

              <label>
                Telefone
                <span className={styles.inputWrap}>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={telefone}
                    onChange={(event) => setTelefone(event.target.value)}
                    placeholder="DDD e numero"
                  />
                  <FaPhone aria-hidden="true" />
                </span>
              </label>

              {error && <p className={styles.formError}>{error}</p>}

              <footer className={styles.modalActions}>
                <button type="button" className={styles.cancelButton} onClick={closeModal}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.saveButton}
                  disabled={!canSubmit}
                  style={{ backgroundColor: theme.colors.primary, color: theme.colors.onPrimary }}
                >
                  <FaSave aria-hidden="true" />
                  {saving ? "Salvando..." : "Salvar alteracoes"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
