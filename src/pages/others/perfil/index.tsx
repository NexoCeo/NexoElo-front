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
import { useLanguage } from "@/context/LanguageContext";
import ProfileOverview from "@/components/profile-overview";
import LoadingState from "@/components/loading-state";

const MAX_SOURCE_PHOTO_BYTES = 30 * 1024 * 1024;
const MAX_UPLOAD_PHOTO_BYTES = 5 * 1024 * 1024;

function isValidPhoto(file: File) {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= MAX_SOURCE_PHOTO_BYTES;
}

async function preparePhoto(file: File): Promise<File> {
  if (!isValidPhoto(file)) throw new Error("Invalid photo");
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = objectUrl;
    await img.decode();
    const scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image processing unavailable");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size > MAX_UPLOAD_PHOTO_BYTES) throw new Error("Unable to optimize photo");
    return new File([blob], "profile-photo.jpg", { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatRole(role?: string, lang: "pt" | "en" = "pt") {
  const labels: Record<string, string> = {
    EMPRESA: lang === "pt" ? "Empresa" : "Business",
    AUTONOMO: lang === "pt" ? "Autônomo" : "Independent professional",
    PROFISSIONAL: lang === "pt" ? "Profissional" : "Professional",
  };

  return labels[role?.toUpperCase() ?? ""] ?? (lang === "pt" ? "Usuário" : "User");
}

export default function Perfil() {
  const { theme } = useTheme();
  const { t, lang } = useLanguage();
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
          const message = t("profile.loadError");
          setError(message);
          showNotification({ type: "error", title: t("profile.unavailable"), message });
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
    if (!isValidPhoto(file)) {
      showNotification({ type: "warning", title: t("profile.invalidPhoto"), message: t("profile.invalidPhotoDesc") });
      return;
    }
    try {
      setPhotoSaving(true);
      const optimizedPhoto = await preparePhoto(file);
      const updated = await atualizarPerfilUsuario(usuario.Id, {
        Nome: usuario.Nome,
        Email: usuario.Email,
        Telefone: usuario.Telefone,
        FotoPerfil: optimizedPhoto,
      });
      setUsuario({
        ...usuario,
        ...updated,
        Papel: updated.Papel || usuario.Papel,
        Slug: updated.Slug || usuario.Slug,
        UrlPublica: updated.UrlPublica || usuario.UrlPublica,
      });
      showNotification({ type: "success", title: t("profile.updatedPhoto"), message: t("profile.updatedPhotoDesc") });
    } catch {
      showNotification({ type: "error", title: t("profile.uploadFailed"), message: t("profile.uploadFailedDesc") });
    } finally {
      setPhotoSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!canSubmit || !usuario) {
      const message = t("profile.review");
      setError(message);
      showNotification({ type: "warning", title: t("profile.invalidData"), message });
      return;
    }

    if (fotoPerfil && !isValidPhoto(fotoPerfil)) {
      const message = t("profile.invalidPhotoDesc");
      setError(message);
      showNotification({ type: "warning", title: t("profile.invalidPhoto"), message });
      return;
    }

    try {
      setSaving(true);
      const optimizedPhoto = fotoPerfil ? await preparePhoto(fotoPerfil) : null;
      const updated = await atualizarPerfilUsuario(usuario.Id, {
        Nome: nome.trim(),
        Email: email.trim(),
        Telefone: telefoneDigits,
        FotoPerfil: optimizedPhoto,
      });

      setUsuario({
        ...usuario,
        ...updated,
        Papel: updated.Papel || usuario.Papel,
        Slug: updated.Slug || usuario.Slug,
        UrlPublica: updated.UrlPublica || usuario.UrlPublica,
      });
      setSuccess(t("profile.saved"));
      showNotification({
        type: "success",
        title: t("profile.savedTitle"),
        message: t("profile.savedDesc"),
      });
      closeModal();
    } catch {
      const message = t("profile.saveFailed");
      setError(message);
      showNotification({ type: "error", title: t("profile.saveFailedTitle"), message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.container} style={{ backgroundColor: theme.colors.background }}>
      {success && <p className={styles.success}>{success}</p>}
      {error && !modalOpen && <p className={styles.error}>{error}</p>}

      <div className={styles.profileShell}>
        {!usuario && loading ? <LoadingState label={t("profile.loading")} /> : <ProfileOverview
          role={formatRole(usuario?.Papel, lang)}
          name={usuario?.Nome || t("profile.notProvided")}
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
          {t("profile.edit")}
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
                  {t("profile.edit")}
                </h2>
                <p style={{ color: theme.colors.inactive }}>
                  {t("profile.changeNotice")}
                </p>
              </div>
              <button type="button" onClick={closeModal} aria-label={t("common.close")} title={t("common.close")}>
                <FaTimes aria-hidden="true" />
              </button>
            </header>

            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.photoField}>
                {t("profile.photo")}
                <span className={styles.photoControl}>
                  <span className={styles.photoPreview}>
                    <img src={fotoPreview} alt={t("profile.photoPreview")} />
                  </span>
                  <span>
                    <strong>{fotoPerfil?.name || t("profile.choosePhoto")}</strong>
                    <small>{t("profile.photoHelp")}</small>
                  </span>
                  <FaCamera aria-hidden="true" />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    aria-label={t("profile.photo")}
                    onChange={(event) => setFotoPerfil(event.target.files?.[0] ?? null)}
                  />
                </span>
              </label>

              <label>
                {t("profile.name")}
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
                {t("profile.email")}
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
                {t("profile.phone")}
                <span className={styles.inputWrap}>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={telefone}
                    onChange={(event) => setTelefone(event.target.value)}
                    placeholder={t("profile.phonePlaceholder")}
                  />
                  <FaPhone aria-hidden="true" />
                </span>
              </label>

              {error && <p className={styles.formError}>{error}</p>}

              <footer className={styles.modalActions}>
                <button type="button" className={styles.cancelButton} onClick={closeModal}>
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className={styles.saveButton}
                  disabled={!canSubmit}
                  style={{ backgroundColor: theme.colors.primary, color: theme.colors.onPrimary }}
                >
                  <FaSave aria-hidden="true" />
                  {saving ? t("profile.saving") : t("common.save")}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
