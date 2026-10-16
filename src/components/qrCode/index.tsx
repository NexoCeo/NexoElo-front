import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { FaCheck, FaCopy } from "react-icons/fa";
import styles from "./style.module.css";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { useNotification } from "@/context/NotificationContext";
import { getClienteFinalAgendamentoUrl, obterSlugUsuario } from "@/services/agenda-publica-service";
import LoadingState from "@/components/loading-state";
import { useLanguage } from "@/context/LanguageContext";

export default function QrCode() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { usuario, setUsuario } = useUser();
  const { showNotification } = useNotification();
  const [slugFallback, setSlugFallback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  const papel = usuario?.Papel?.toUpperCase();
  const canShowAgendaPublica = papel === "EMPRESA" || papel === "AUTONOMO";
  const slug = usuario?.Slug?.trim() || slugFallback;
  const urlAgendamento = slug ? getClienteFinalAgendamentoUrl(slug) : "";

  // Sessões atuais já trazem o slug: o QR é renderizado no primeiro frame.
  // Somente sessões legadas sem slug precisam consultar o backend.
  useEffect(() => {
    if (!usuario?.Id || !canShowAgendaPublica || usuario.Slug?.trim()) return;
    let active = true;
    setLoading(true);
    setError("");
    obterSlugUsuario(usuario.Id)
      .then(value => {
        if (!active) return;
        if (!value) {
          setError(t("qr.unavailable"));
          return;
        }
        setSlugFallback(value);
        setUsuario({ ...usuario, Slug: value });
      })
      .catch(() => {
        if (active) setError(t("qr.loadFailed"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [usuario?.Id, usuario?.Slug, canShowAgendaPublica, setUsuario]);

  useEffect(() => {
    if (copyStatus !== "copied") return;
    const timeoutId = window.setTimeout(() => setCopyStatus("idle"), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

  async function copyAgendaLink() {
    if (!urlAgendamento) return;
    try {
      await navigator.clipboard.writeText(urlAgendamento);
      setCopyStatus("copied");
      showNotification({
        type: "success",
        title: t("qr.copied"),
        message: t("qr.copiedDescription"),
      });
    } catch {
      setCopyStatus("error");
      showNotification({
        type: "error",
        title: t("qr.notCopied"),
        message: t("qr.copyFailed"),
      });
    }
  }

  if (!usuario || !canShowAgendaPublica) return null;

  return (
    <section className={styles.wrapper}>
      <div className={styles.header}>
        <h3 style={{ color: theme.colors.text }}>{t("qr.title")}</h3>
        <p style={{ color: theme.colors.inactive }}>
          {t("qr.description")}
        </p>
      </div>

      {urlAgendamento ? (
        <div className={styles.content}>
          <div className={styles.container}>
            <QRCodeSVG
              value={urlAgendamento}
              title={t("qr.title")}
              size={200}
              level="Q"
              marginSize={2}
              className={styles.qrCode}
            />
          </div>
          <div className={styles.linkBox}>
            <button
              type="button"
              className={`${styles.copyLinkButton} ${copyStatus === "copied" ? styles.copyLinkButtonSuccess : ""}`}
              onClick={copyAgendaLink}
              aria-label={copyStatus === "copied" ? t("qr.copied") : t("qr.copy")}
            >
              <span>{copyStatus === "copied" ? t("qr.copied") : t("qr.copy")}</span>
              {copyStatus === "copied" ? <FaCheck aria-hidden="true" /> : <FaCopy aria-hidden="true" />}
            </button>
            {copyStatus === "error" && (
              <p className={styles.copyError} role="alert">Não foi possível copiar o link. Tente novamente.</p>
            )}
          </div>
        </div>
      ) : loading ? (
        <LoadingState label={t("qr.preparing")} compact />
      ) : (
        <p className={styles.error}>{error || t("qr.unavailable")}</p>
      )}
    </section>
  );
}
