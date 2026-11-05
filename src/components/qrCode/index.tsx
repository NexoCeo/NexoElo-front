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
import { getUploadedImageUrl } from "@/components/header/profile-image";
import { formatPersonName } from "@/context/UserContext";

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
    if (!svg || !urlAgendamento || !usuario || downloading) return;

    setDownloading(true);
    const objectUrls: string[] = [];
    try {
      function loadImage(src: string, external = false): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
          const img = new Image();
          if (external) img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("Falha ao carregar imagem"));
          img.src = src;
        });
      }
      const clonedQr = svg.cloneNode(true) as SVGSVGElement;
      clonedQr.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clonedQr.setAttribute("width", "800");
      clonedQr.setAttribute("height", "800");
      const qrUrl = URL.createObjectURL(new Blob(
        [new XMLSerializer().serializeToString(clonedQr)],
        { type: "image/svg+xml;charset=utf-8" },
      ));
      objectUrls.push(qrUrl);
      const qrImage = await loadImage(qrUrl);

      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 1600;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponível");
      const roundedBox = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
      };

      ctx.fillStyle = "#eee6db";
      ctx.fillRect(0, 0, 1200, 1600);
      const gradient = ctx.createLinearGradient(0, 0, 1200, 1600);
      gradient.addColorStop(0, "#fffdf9");
      gradient.addColorStop(1, "#faf5ed");
      roundedBox(76, 70, 1048, 1460, 42);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = "#dcd0bf";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#607396";
      ctx.font = "700 27px Arial, sans-serif";
      ctx.fillText("NEXOELO  •  AGENDA PÚBLICA", 600, 166);

      const name = formatPersonName(usuario.Nome) || "Agenda pública";
      const photoUrl = getUploadedImageUrl(usuario.FotoPerfil);
      let photo: HTMLImageElement | null = null;
      if (photoUrl) {
        try { photo = await loadImage(photoUrl, true); }
        catch { photo = null; }
      }
      ctx.save();
      ctx.beginPath();
      ctx.arc(600, 315, 100, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "#dce7f7";
      ctx.fillRect(500, 215, 200, 200);
      if (photo) {
        const ratio = Math.max(200 / photo.naturalWidth, 200 / photo.naturalHeight);
        const w = photo.naturalWidth * ratio;
        const h = photo.naturalHeight * ratio;
        ctx.drawImage(photo, 600 - w / 2, 315 - h / 2, w, h);
      } else {
        const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("");
        ctx.fillStyle = "#225ca8";
        ctx.font = "700 68px Arial, sans-serif";
        ctx.fillText(initials || "N", 600, 320);
      }
      ctx.restore();
      ctx.strokeStyle = "#cfbaa0";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(600, 315, 104, 0, Math.PI * 2);
      ctx.stroke();

      let fontSize = 62;
      ctx.fillStyle = "#253247";
      while (fontSize > 30) {
        ctx.font = "700 " + fontSize + "px Georgia, serif";
        if (ctx.measureText(name).width <= 880) break;
        fontSize -= 2;
      }
      ctx.fillText(name, 600, 478, 880);
      ctx.fillStyle = "#45556e";
      ctx.font = "400 41px Arial, sans-serif";
      ctx.fillText("Escaneie para agendar", 600, 565);
      ctx.fillStyle = "#728096";
      ctx.font = "400 27px Arial, sans-serif";
      ctx.fillText("Escolha seu serviço e reserve seu horário.", 600, 620);

      roundedBox(218, 703, 764, 764, 30);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#e6e5e0";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(qrImage, 256, 741, 688, 688);
      ctx.imageSmoothingEnabled = true;
      ctx.fillStyle = "#64748b";
      ctx.font = "600 24px Arial, sans-serif";
      ctx.fillText("APONTE A CÂMERA DO CELULAR", 600, 1485);

      const png = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Falha ao gerar PNG")), "image/png");
      });
      const downloadUrl = URL.createObjectURL(png);
      objectUrls.push(downloadUrl);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "nexoelo-agenda-" + slug + ".png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      showNotification({ type: "success", title: "Cartão da agenda pronto", message: "Imagem preparada para download." });
    } catch {
      showNotification({ type: "error", title: "Erro ao baixar cartão", message: "Não foi possível gerar o cartão. Tente novamente." });
    } finally {
      window.setTimeout(() => objectUrls.forEach(url => URL.revokeObjectURL(url)), 1000);
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
            {downloading ? "Preparando cartão..." : "Baixar cartão da agenda"}
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
