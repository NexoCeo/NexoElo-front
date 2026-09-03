import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { FaCheck, FaCopy } from "react-icons/fa";
import styles from "./style.module.css";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { useNotification } from "@/context/NotificationContext";
import {
  getClienteFinalAgendamentoUrl,
  obterAgendaPublica,
  obterSlugUsuario,
} from "@/services/agenda-publica-service";
import type { AgendaPublica } from "@/types/agenda-publica";

export default function QrCode() {
  const { theme } = useTheme();
  const { usuario } = useUser();
  const { showNotification } = useNotification();
  const [agendaPublica, setAgendaPublica] = useState<AgendaPublica | null>(null);
  const [urlAgendamento, setUrlAgendamento] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  const papel = usuario?.Papel?.toUpperCase();
  const canShowAgendaPublica = papel === "EMPRESA" || papel === "AUTONOMO";

  useEffect(() => {
    async function loadAgendaPublica() {
      if (!usuario?.Id || !canShowAgendaPublica) {
        setAgendaPublica(null);
        setUrlAgendamento("");
        return;
      }

      try {
        setLoading(true);
        setError("");
        const slug = usuario.Slug || await obterSlugUsuario(usuario.Id);

        if (!slug) {
          const message = "Slug da agenda publica nao encontrado.";
          setError(message);
          showNotification({ type: "error", title: "Agenda publica indisponivel", message });
          return;
        }

        const agenda = await obterAgendaPublica(slug);
        const agendaSlug = agenda.Slug || slug;
        setAgendaPublica(agenda);
        setUrlAgendamento(getClienteFinalAgendamentoUrl(agendaSlug));
      } catch {
        const message = "Nao foi possivel carregar a agenda publica.";
        setError(message);
        showNotification({ type: "error", title: "Agenda publica indisponivel", message });
      } finally {
        setLoading(false);
      }
    }

    loadAgendaPublica();
  }, [canShowAgendaPublica, showNotification, usuario?.Id, usuario?.Slug]);

  useEffect(() => {
    if (copyStatus !== "copied") {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopyStatus("idle"), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

  async function copyAgendaLink() {
    if (!urlAgendamento) {
      return;
    }

    try {
      await navigator.clipboard.writeText(urlAgendamento);
      setCopyStatus("copied");
      showNotification({
        type: "success",
        title: "Link copiado",
        message: "O link da agenda publica esta pronto para compartilhar.",
      });
    } catch {
      setCopyStatus("error");
      showNotification({
        type: "error",
        title: "Link nao copiado",
        message: "Nao foi possivel copiar o link. Tente novamente.",
      });
    }
  }

  if (!usuario || !canShowAgendaPublica) {
    return null;
  }

  return (
    <section className={styles.wrapper}>
      <div className={styles.header}>
        <h3 style={{ color: theme.colors.text }}>Agenda publica</h3>
        <p style={{ color: theme.colors.inactive }}>
          Compartilhe o QR Code ou o link para clientes agendarem.
        </p>
      </div>

      {loading ? (
        <p className={styles.feedback} style={{ color: theme.colors.inactive }}>Carregando agenda publica...</p>
      ) : error ? (
        <p className={styles.error}>{error}</p>
      ) : agendaPublica ? (
        <div className={styles.content}>
          {urlAgendamento && (
            <div className={styles.container}>
              <QRCodeSVG
                value={urlAgendamento}
                title="QR Code da agenda publica"
                size={200}
                level="Q"
                marginSize={2}
                className={styles.qrCode}
              />
            </div>
          )}

          {urlAgendamento && (
            <div className={styles.linkBox}>
              <button
                type="button"
                className={`${styles.copyLinkButton} ${copyStatus === "copied" ? styles.copyLinkButtonSuccess : ""}`}
                onClick={copyAgendaLink}
                aria-label={copyStatus === "copied" ? "Link copiado" : "Copiar link da agenda publica"}
              >
                <span>{copyStatus === "copied" ? "Link copiado" : "Copiar link da agenda publica"}</span>
                {copyStatus === "copied" ? <FaCheck aria-hidden="true" /> : <FaCopy aria-hidden="true" />}
              </button>
              {copyStatus === "error" && (
                <p className={styles.copyError} role="alert">
                  Nao foi possivel copiar o link. Tente novamente.
                </p>
              )}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
