import { FormEvent, useEffect, useMemo, useState } from "react";
import { FaEnvelope, FaPen, FaPhone, FaUser } from "react-icons/fa";
import { getProfileImageUrl, getUploadedImageUrl } from "@/components/header/profile-image";
import {
  EntityEditorModal,
  EntityImageField,
  EntityEditorForm,
  EntityEditorField,
  EntityEditorError,
  EntityEditorSubmit,
} from "@/components/entity-editor-modal";
import ServiceImageCrop from "../servicos/service-image-crop";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { useNotification } from "@/context/NotificationContext";
import {
  atualizarPerfilUsuario,
  obterPerfilUsuario,
  obterFotoOriginalUsuario,
} from "@/services/usuario-service";
import styles from "./style.module.css";
import { useLanguage } from "@/context/LanguageContext";
import { usePageRevalidation } from "@/hooks/usePageRevalidation";
import ProfileOverview from "@/components/profile-overview";
import LoadingState from "@/components/loading-state";

const MAX_SOURCE_PHOTO_BYTES = 20 * 1024 * 1024;

function isValidPhoto(file: File) {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= MAX_SOURCE_PHOTO_BYTES;
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
  const [fotoOriginal, setFotoOriginal] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState("");
  const [cropSource, setCropSource] = useState("");
  const [cropFilename, setCropFilename] = useState("perfil");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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
    !saving &&
    !cropSource;

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

  usePageRevalidation(async () => {
    if (!userId) return;
    try {
      const profile = await obterPerfilUsuario(userId);
      setUsuario(profile);
    } catch { /* retain the existing profile when offline */ }
  }, { enabled: Boolean(userId) && !modalOpen && !saving && !cropSource });

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
    return () => {
      if (cropSource.startsWith("blob:")) URL.revokeObjectURL(cropSource);
    };
  }, [cropSource]);

  // O mesmo fluxo de edição é utilizado por EMPRESA, AUTONOMO e PROFISSIONAL.
  function openModal(selectedPhoto?: File) {
    setNome(usuario?.Nome ?? "");
    setEmail(usuario?.Email ?? "");
    setTelefone(usuario?.Telefone ?? "");
    setFotoPerfil(null);
    setFotoOriginal(null);
    setCropSource("");
    setError("");
    setSuccess("");
    setModalOpen(true);
    if (selectedPhoto) selectPhotoForCrop(selectedPhoto);
  }

  function closeModal() {
    setModalOpen(false);
    setFotoPerfil(null);
    setFotoOriginal(null);
    setCropSource("");
    setError("");
  }

  function selectPhotoForCrop(file: File | null) {
    if (!file) return;
    if (!isValidPhoto(file)) {
      const message = "Selecione uma foto JPG, PNG ou WebP com até 20 MB.";
      setError(message);
      showNotification({ type: "warning", title: t("profile.invalidPhoto"), message });
      return;
    }
    setError("");
    setFotoPerfil(null);
    setFotoOriginal(file);
    setCropFilename(file.name);
    setCropSource(URL.createObjectURL(file));
  }

  async function adjustCrop() {
    setError("");
    if (fotoOriginal) {
      setCropFilename(fotoOriginal.name);
      setCropSource(URL.createObjectURL(fotoOriginal));
      return;
    }

    if (!usuario?.Id) return;
    try {
      const original = await obterFotoOriginalUsuario(usuario.Id);
      if (original) {
        setFotoOriginal(original);
        setCropFilename(original.name);
        setCropSource(URL.createObjectURL(original));
        return;
      }
      showNotification({
        type: "warning",
        title: "Foto original não disponível",
        message: "Esta foto foi cadastrada antes da preservação do arquivo original. Reenvie a foto completa para recuperar o enquadramento.",
      });
    } catch {
      showNotification({
        type: "warning",
        title: "Não foi possível carregar a imagem original",
        message: "Você pode usar o recorte salvo ou selecionar a foto completa novamente.",
      });
    }

    const existing = getUploadedImageUrl(usuario.FotoPerfil);
    if (!existing) return;
    setCropFilename(usuario.Nome || "perfil");
    setCropSource(existing);
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

    if (fotoOriginal && !isValidPhoto(fotoOriginal)) {
      const message = t("profile.invalidPhotoDesc");
      setError(message);
      showNotification({ type: "warning", title: t("profile.invalidPhoto"), message });
      return;
    }

    try {
      setSaving(true);
      const updated = await atualizarPerfilUsuario(usuario.Id, {
        Nome: nome.trim(),
        Email: email.trim(),
        Telefone: telefoneDigits,
        FotoPerfil: fotoPerfil,
        FotoOriginal: fotoPerfil ? fotoOriginal : null,
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
          companyDetails={usuario?.Papel === "EMPRESA" ? {
            tradeName: usuario.NomeFantasia,
            cnpj: usuario.Cnpj,
          } : undefined}
          avatarUrl={getProfileImageUrl(usuario?.FotoPerfil)}
          onPhotoChange={usuario && !loading ? (file) => openModal(file) : undefined}
          action={<button
          type="button"
          className={styles.editButton}
          onClick={() => openModal()}
          disabled={!usuario || loading}
          style={{ backgroundColor: theme.colors.primary, color: theme.colors.onPrimary }}
        >
          <FaPen aria-hidden="true" />
          {t("profile.edit")}
        </button>}
        />}
      </div>

      {modalOpen && (
        <EntityEditorModal
          title={t("profile.edit")}
          description={t("profile.changeNotice")}
          onClose={closeModal}
          busy={saving}
          cropOpen={Boolean(cropSource)}
        >
          <EntityEditorForm onSubmit={handleSubmit}>
            <EntityImageField
              label={t("profile.photo")}
              alt={t("profile.photoPreview")}
              previewUrl={fotoPreview}
              selectedFile={fotoPerfil}
              onSelectFile={selectPhotoForCrop}
              onAdjustCrop={fotoOriginal || getUploadedImageUrl(usuario?.FotoPerfil)
                ? () => void adjustCrop()
                : undefined}
              cropContent={cropSource ? (
                <ServiceImageCrop
                  source={cropSource}
                  filename={cropFilename}
                  onCancel={() => setCropSource("")}
                  onApply={(file) => {
                    setFotoPerfil(file);
                    setCropSource("");
                    setError("");
                  }}
                />
              ) : null}
            />

            <EntityEditorField label={t("profile.name")} icon={<FaUser />}>
              <input
                type="text"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                placeholder={t("profile.name")}
              />
            </EntityEditorField>
            <EntityEditorField label={t("profile.email")} icon={<FaEnvelope />}>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email@exemplo.com"
              />
            </EntityEditorField>
            <EntityEditorField label={t("profile.phone")} icon={<FaPhone />}>
              <input
                type="tel"
                inputMode="numeric"
                value={telefone}
                onChange={(event) => setTelefone(event.target.value)}
                placeholder={t("profile.phonePlaceholder")}
              />
            </EntityEditorField>

            <EntityEditorError message={error} />
            <EntityEditorSubmit disabled={!canSubmit}>
              {saving ? t("profile.saving") : t("common.save")}
            </EntityEditorSubmit>
          </EntityEditorForm>
        </EntityEditorModal>
      )}
    </main>
  );
}
