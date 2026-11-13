import { FaCamera, FaEnvelope, FaPhoneAlt, FaStore, FaIdCard } from "react-icons/fa";
import styles from "./style.module.css";
import { formatPersonName, formatEmailDisplay, formatPhoneDisplay, formatCnpjDisplay } from "@/context/UserContext";
import { useLanguage } from "@/context/LanguageContext";

type ProfileOverviewProps = {
  name: string;
  role: string;
  email?: string | null;
  phone?: string | null;
  companyDetails?: { tradeName?: string | null; cnpj?: string | null };
  avatarUrl?: string | null;
  className?: string;
  action?: React.ReactNode;
  subtitle?: string;
  onPhotoChange?: (file: File) => void;
  photoSaving?: boolean;
};

export default function ProfileOverview({ name, role, email, phone, companyDetails, avatarUrl, className, action, subtitle, onPhotoChange, photoSaving = false }: ProfileOverviewProps) {
  const { t } = useLanguage();
  const displayName = formatPersonName(name);
  const initial = displayName.charAt(0) || "?";
  return (
    <section className={`${styles.profile} ${className || ""}`} aria-label={t("profile.info")}>
      <div className={styles.avatar}>
        {avatarUrl ? <img src={avatarUrl} alt={`${t("profile.photo")}: ${displayName}`} /> : <span aria-hidden="true">{initial}</span>}
        {onPhotoChange && (
          <label className={styles.cameraButton} title={t("profile.photoUpload")} aria-label={t("profile.photoUpload")}>
            {photoSaving ? <span className={styles.spinner} aria-hidden="true" /> : <FaCamera aria-hidden="true" />}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label={t("profile.choosePhoto")}
              disabled={photoSaving}
              onChange={event => {
                const file = event.currentTarget.files?.[0];
                if (file) onPhotoChange(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
        )}
      </div>
      <div className={styles.heading}>
        <h2 title={displayName}>{displayName}</h2>
        <span className={styles.role}>{role}</span>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <dl className={styles.details}>
        <div><dt><FaEnvelope aria-hidden="true" /> {t("profile.email")}</dt><dd title={formatEmailDisplay(email) || t("profile.notProvided")}>{formatEmailDisplay(email) || t("profile.notProvided")}</dd></div>
        <div><dt><FaPhoneAlt aria-hidden="true" /> {t("profile.phone")}</dt><dd title={formatPhoneDisplay(phone) || t("profile.notProvided")}>{formatPhoneDisplay(phone) || t("profile.notProvided")}</dd></div>
        {companyDetails && (
          <>
            <div><dt><FaStore aria-hidden="true" /> {t("profile.tradeName")}</dt><dd title={formatPersonName(companyDetails.tradeName) || t("profile.notProvided")}>{formatPersonName(companyDetails.tradeName) || t("profile.notProvided")}</dd></div>
            <div><dt><FaIdCard aria-hidden="true" /> {t("profile.cnpj")}</dt><dd title={formatCnpjDisplay(companyDetails.cnpj) || t("profile.notProvided")}>{formatCnpjDisplay(companyDetails.cnpj) || t("profile.notProvided")}</dd></div>
          </>
        )}
      </dl>
      {action && <div className={styles.action}>{action}</div>}
    </section>
  );
}
