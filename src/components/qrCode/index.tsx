import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { FaCheck, FaCopy, FaDownload } from "react-icons/fa";
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
  const qrRef = useRef<HTMLDivElement | null>(null);
  const [slugFallback, setSlugFallback] = useState("");
  const [downloading, setDownloading] = useState(false);
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

  async function downloadQrCode() {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg || !urlAgendamento || downloading) return;

    setDownloading(true);
    let svgUrl = "";
    try {
      // Reutiliza exatamente o QR Code exibido no modal; nao cria outra URL.
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("width", "1024");
      clone.setAttribute("height", "1024");
      const svgMarkup = new XMLSerializer().serializeToString(clone);
      svgUrl = URL.createObjectURL(new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" }));

      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Falha na conversao do QR Code."));
        image.src = svgUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponivel.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const png = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Nao foi possivel criar o PNG.")), "image/png");
      });

      const pngUrl = URL.createObjectURL(png);
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `nexoelo-agenda-${slug}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
      showNotification({ type: "success", title: "QR Code pronto", message: "Imagem PNG baixada com sucesso." });
    } catch {
      showNotification({ type: "error", title: "Erro ao baixar QR Code", message: "Não foi possível gerar a imagem. Tente novamente." });
    } finally {
      if (svgUrl) URL.revokeObjectURL(svgUrl);
      setDownloading(false);
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
          <div className={styles.container} ref={qrRef}>
            <QRCodeSVG
              value={urlAgendamento}
              title={t("qr.title")}
              size={200}
              level="Q"
              marginSize={2}
              className={styles.qrCode}
            />
          </div>
          <button type="button" className={styles.downloadButton} onClick={() => void downloadQrCode()} disabled={downloading}>
            <FaDownload aria-hidden="true" />
            {downloading ? "Preparando imagem..." : "Baixar QR Code"}
          </button>
          <div className={styles.linkBox}>
            <button
              type="button"
              className={`${styles.copyLinkButton} ${copyStatus === "copied" ? styles.copyLinkButtonSuccess : ""}`}
              onClick={copyAgendaLink}
              aria-label={copyStatus === "copied" ? t("qr.copied") : t("qr.copy")}
            >
              <span>{copyStatus === "copied" ? t("qr.copied") : t("qr.copy")}</span>
              <span className={styles.copyIcon}>{copyStatus === "copied" ? <FaCheck aria-hidden="true" /> : <FaCopy aria-hidden="true" />}</span>
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
