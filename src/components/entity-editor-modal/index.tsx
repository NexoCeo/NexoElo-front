import type { ChangeEvent, ReactNode } from "react";
import { useEffect } from "react";
import { FaCloudUploadAlt, FaCropAlt, FaImage, FaTimes } from "react-icons/fa";
import styles from "./style.module.css";

type EntityEditorModalProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  description?: string;
  busy?: boolean;
  cropOpen?: boolean;
};

export function EntityEditorModal({
  title, children, onClose, description, busy = false, cropOpen = false,
}: EntityEditorModalProps) {
  useEffect(() => {
    if (cropOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, cropOpen, onClose]);

  return (
    <div className={styles.backdrop} role="presentation">
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-label={title}>
        <header className={styles.header}>
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" onClick={onClose} disabled={busy || cropOpen}
            aria-label="Fechar modal" title="Fechar modal">
            <FaTimes aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

type EntityImageFieldProps = {
  label: string;
  previewUrl: string;
  alt: string;
  selectedFile?: File | null;
  onSelectFile?: (file: File | null) => void;
  onAdjustCrop?: () => void;
  cropContent?: ReactNode;
  readonlyHint?: string;
};

export function EntityImageField({
  label, previewUrl, alt, selectedFile, onSelectFile, onAdjustCrop,
  cropContent, readonlyHint,
}: EntityImageFieldProps) {
  const hasCropOpen = Boolean(cropContent);
  const uploadEnabled = typeof onSelectFile === "function" && !readonlyHint;
  return (
    <div className={styles.imageField}>
      <div className={styles.imageFieldHeading}><strong>{label}</strong></div>
      {!hasCropOpen && (
        <div className={styles.imagePickerCard}>
          <div className={styles.imageLargePreview} aria-label={`Prévia: ${label}`}>
            {previewUrl ? <img src={previewUrl} alt={alt} /> : <FaImage aria-hidden="true" />}
          </div>
          <div className={styles.imagePickerContent}>
            <strong>{selectedFile ? "Nova imagem pronta" : previewUrl ? "Imagem atual" : "Adicione uma foto"}</strong>
            {readonlyHint && <span className={styles.readonlyHint}>{readonlyHint}</span>}
            {uploadEnabled && (
              <div className={styles.imagePickerActions}>
                <label className={styles.imageUploadAction}>
                  <FaCloudUploadAlt aria-hidden="true" />
                  {previewUrl ? "Trocar foto" : "Escolher foto"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" aria-label={label}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      onSelectFile?.(event.target.files?.[0] ?? null);
                      event.currentTarget.value = "";
                    }} />
                </label>
                {previewUrl && onAdjustCrop && (
                  <button type="button" className={styles.cropButton} onClick={onAdjustCrop}>
                    <FaCropAlt aria-hidden="true" /> Ajustar recorte
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {cropContent}
    </div>
  );
}
