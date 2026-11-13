import { FormEvent, useEffect, useMemo, useState } from "react";
import { FaEnvelope, FaIdCard, FaPen, FaPhone, FaUser } from "react-icons/fa";
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
// O formato alfanumerico (12 caracteres + 2 digitos) tambem e valido desde 2026.
const normalizeCnpj = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);

function formatCnpj(value: string): string {
  const cnpj = normalizeCnpj(value);
  let result = cnpj.slice(0, 2);
  if (cnpj.length > 2) result += "." + cnpj.slice(2, 5);
  if (cnpj.length > 5) result += "." + cnpj.slice(5, 8);
  if (cnpj.length > 8) result += "/" + cnpj.slice(8, 12);
  if (cnpj.length > 12) result += "-" + cnpj.slice(12, 14);
  return result;
}

function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(cnpj) ||
      cnpj.slice(0, 12).split("").every(char => char === cnpj[0])) return false;

  const calc = (weights: number[]) => {
    const sum = weights.reduce((total, weight, index) =>
      total + (cnpj.charCodeAt(index) - 48) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return Number(cnpj[12]) === calc([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) &&
    Number(cnpj[13]) === calc([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
}


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
  const [cnpj, setCnpj] = useState("");
  const [fotoPerfil, setFotoPerfil] = useState<File | null>(null);
  const [fotoOriginal, setFotoOriginal] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState("");
  const [cropSource, setCropSource] = useState("");
  const [cropFilename, setCropFilename] = useState("perfil");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const userId = usuario?.Id ?? 0;
  const telefoneDigits = useMemo(
    () => telefone.replace(/\D/g, ""),
    [telefone],
  );
  const isEmpresa = usuario?.Papel === "EMPRESA";
  const cnpjChanged = isEmpresa &&
    normalizeCnpj(cnpj) !== normalizeCnpj(usuario?.Cnpj ?? "");
  const cnpjValid = !cnpjChanged || isValidCnpj(cnpj);
  const canSubmit =
    nome.trim().length > 0 &&
    emailPattern.test(email.trim()) &&
    (!telefoneDigits || (telefoneDigits.length >= 10 && telefoneDigits.length <= 11)) &&
    cnpjValid &&
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
    setCnpj(formatCnpj(usuario?.Cnpj ?? ""));
    setFotoPerfil(null);
    setFotoOriginal(null);
    setCropSource("");
    setModalOpen(true);
    if (selectedPhoto) selectPhotoForCrop(selectedPhoto);
  }

  function closeModal() {
    setModalOpen(false);
    setFotoPerfil(null);
    setFotoOriginal(null);
    setCropSource("");
  }

  function selectPhotoForCrop(file: File | null) {
    if (!file) return;
    if (!isValidPhoto(file)) {
      const message = "Selecione uma foto JPG, PNG ou WebP com até 20 MB.";
      showNotification({ type: "warning", title: t("profile.invalidPhoto"), message });
      return;
    }
    setFotoPerfil(null);
    setFotoOriginal(file);
    setCropFilename(file.name);
    setCropSource(URL.createObjectURL(file));
  }

  async function adjustCrop() {
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

    if (!canSubmit || !usuario) {
      const message = t("profile.review");
      showNotification({ type: "warning", title: t("profile.invalidData"), message });
      return;
    }

    if (fotoOriginal && !isValidPhoto(fotoOriginal)) {
      const message = t("profile.invalidPhotoDesc");
      showNotification({ type: "warning", title: t("profile.invalidPhoto"), message });
      return;
    }

    try {
      setSaving(true);
      const updated = await atualizarPerfilUsuario(usuario.Id, {
        Nome: nome.trim(),
        Email: email.trim(),
        Telefone: telefoneDigits,
        ...(cnpjChanged ? { Cnpj: formatCnpj(cnpj) } : {}),
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
      showNotification({
        type: "success",
        title: t("profile.savedTitle"),
        message: t("profile.savedDesc"),
      });
      closeModal();
    } catch {
      const message = t("profile.saveFailed");
      showNotification({ type: "error", title: t("profile.saveFailedTitle"), message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.container} style={{ backgroundColor: theme.colors.background }}>

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
            {isEmpresa && (
              <>
                <EntityEditorField label={t("profile.cnpj")} icon={<FaIdCard />}>
                  <input
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    value={cnpj}
                    onChange={(event) => setCnpj(formatCnpj(event.target.value))}
                    maxLength={18}
                    placeholder="00.000.000/0000-00"
                    aria-invalid={cnpjChanged && !cnpjValid}
                  />
                </EntityEditorField>
                {cnpjChanged && !cnpjValid && (
                  <EntityEditorError message="Informe um CNPJ válido com 14 caracteres e dígitos verificadores corretos." />
                )}
              </>
            )}

            <EntityEditorSubmit disabled={!canSubmit}>
              {saving ? t("profile.saving") : t("common.save")}
            </EntityEditorSubmit>
          </EntityEditorForm>
        </EntityEditorModal>
      )}
    </main>
  );
}
