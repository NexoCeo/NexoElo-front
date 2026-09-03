import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { isAxiosError } from "axios";
import {
  FaCalendarAlt,
  FaChartBar,
  FaDownload,
  FaEye,
  FaFileInvoiceDollar,
  FaTimes,
} from "react-icons/fa";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { useNotification } from "@/context/NotificationContext";
import {
  gerarRelatorioPdf,
  nomeArquivoRelatorio,
  type TipoRelatorio,
} from "@/services/relatorio-service";
import styles from "./style.module.css";

const PdfPreview = lazy(() => import("@/components/pdf-preview"));

type RelatorioConfig = {
  tipo: TipoRelatorio;
  titulo: string;
  descricao: string;
  observacao: string;
  icone: ReactNode;
  tom: "financeiro" | "servicos" | "agenda";
};

const relatorios: RelatorioConfig[] = [
  {
    tipo: "resumo-financeiro",
    titulo: "Resumo financeiro",
    descricao: "Faturamento, ticket medio e atendimentos concluidos.",
    observacao: "Valores por dia no mes selecionado",
    icone: <FaFileInvoiceDollar aria-hidden="true" />,
    tom: "financeiro",
  },
  {
    tipo: "servicos-mais-realizados",
    titulo: "Servicos mais realizados",
    descricao: "Ranking por quantidade, participacao e faturamento.",
    observacao: "Somente atendimentos concluidos",
    icone: <FaChartBar aria-hidden="true" />,
    tom: "servicos",
  },
  {
    tipo: "agenda-mensal",
    titulo: "Agenda mensal",
    descricao: "Agendamentos, clientes, profissionais, valores e status.",
    observacao: "Visao completa do periodo",
    icone: <FaCalendarAlt aria-hidden="true" />,
    tom: "agenda",
  },
];

function mesAtual() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
}

function baixarBlob(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function Relatorios() {
  const { theme } = useTheme();
  const { usuario } = useUser();
  const { showNotification } = useNotification();
  const [periodo, setPeriodo] = useState(mesAtual);
  const [modalOpen, setModalOpen] = useState(false);
  const [relatorioAtivo, setRelatorioAtivo] = useState<RelatorioConfig | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [loadingAction, setLoadingAction] = useState("");
  const [error, setError] = useState("");

  const [ano, mes] = useMemo(
    () => periodo.split("-").map((value) => Number(value)),
    [periodo],
  );
  const rolePermitida = usuario?.Papel === "EMPRESA" || usuario?.Papel === "AUTONOMO";
  const pageStyle = {
    "--reports-bg": theme.colors.background,
    "--reports-panel": theme.colors.background2,
    "--reports-text": theme.colors.text,
    "--reports-muted": theme.colors.inactive,
    "--reports-primary": theme.colors.primary,
    "--reports-border": theme.colors.bottom,
  } as CSSProperties;

  useEffect(() => {
    if (!modalOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        fecharModal();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [modalOpen]);

  function mensagemErro(errorValue: unknown) {
    if (isAxiosError(errorValue) && errorValue.response?.status === 403) {
      return "Seu perfil nao possui permissao para acessar este relatorio.";
    }

    return "Nao foi possivel gerar o relatorio. Tente novamente.";
  }

  async function visualizarRelatorio(relatorio: RelatorioConfig) {
    setRelatorioAtivo(relatorio);
    setModalOpen(true);
    setPdfBlob(null);
    setError("");
    setLoadingAction(`${relatorio.tipo}:preview`);

    try {
      const arquivo = await gerarRelatorioPdf(relatorio.tipo, ano, mes);
      setPdfBlob(arquivo);
      showNotification({
        type: "success",
        title: "Relatorio pronto",
        message: `${relatorio.titulo} foi gerado para visualizacao.`,
      });
    } catch (errorValue) {
      const message = mensagemErro(errorValue);
      setError(message);
      showNotification({ type: "error", title: "Relatorio nao gerado", message });
    } finally {
      setLoadingAction("");
    }
  }

  async function baixarRelatorio(relatorio: RelatorioConfig) {
    setError("");
    setLoadingAction(`${relatorio.tipo}:download`);

    try {
      const arquivo = await gerarRelatorioPdf(relatorio.tipo, ano, mes);
      baixarBlob(arquivo, nomeArquivoRelatorio(relatorio.tipo, ano, mes));
      showNotification({
        type: "success",
        title: "Download iniciado",
        message: `${relatorio.titulo} esta sendo baixado em PDF.`,
      });
    } catch (errorValue) {
      const message = mensagemErro(errorValue);
      setError(message);
      showNotification({ type: "error", title: "Download nao iniciado", message });
    } finally {
      setLoadingAction("");
    }
  }

  function baixarRelatorioAtivo() {
    if (!pdfBlob || !relatorioAtivo) {
      return;
    }

    baixarBlob(
      pdfBlob,
      nomeArquivoRelatorio(relatorioAtivo.tipo, ano, mes),
    );
    showNotification({
      type: "success",
      title: "Download iniciado",
      message: `${relatorioAtivo.titulo} esta sendo baixado em PDF.`,
    });
  }

  function fecharModal() {
    setModalOpen(false);
    setRelatorioAtivo(null);
    setPdfBlob(null);
    setError("");
    setLoadingAction("");
  }

  if (!rolePermitida) {
    return (
      <main className={styles.container} style={pageStyle}>
        <section className={styles.pageHeader}>
          <h1>Relatorios</h1>
          <p>Esta area esta disponivel apenas para empresas e autonomos.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.container} style={pageStyle}>
      <section className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Analise do negocio</span>
          <h1>Relatorios</h1>
          <p>Acompanhe os resultados consolidados dos seus atendimentos.</p>
        </div>

        <label className={styles.periodField}>
          <span>Mes de referencia</span>
          <span className={styles.periodControl}>
            <FaCalendarAlt aria-hidden="true" />
            <input
              type="month"
              min="2000-01"
              max="2100-12"
              value={periodo}
              onChange={(event) => setPeriodo(event.target.value || mesAtual())}
            />
          </span>
        </label>
      </section>

      {error && !modalOpen && (
        <p className={styles.pageError} role="alert">
          {error}
        </p>
      )}

      <section className={styles.reportGrid} aria-label="Relatorios disponiveis">
        {relatorios.map((relatorio) => {
          const previewLoading = loadingAction === `${relatorio.tipo}:preview`;
          const downloadLoading = loadingAction === `${relatorio.tipo}:download`;

          return (
            <article
              key={relatorio.tipo}
              className={`${styles.reportCard} ${styles[relatorio.tom]}`}
            >
              <header className={styles.cardHeader}>
                <span className={styles.cardIcon}>{relatorio.icone}</span>
                <span className={styles.pdfBadge}>PDF</span>
              </header>
              <div className={styles.cardContent}>
                <h2>{relatorio.titulo}</h2>
                <p>{relatorio.descricao}</p>
                <small>{relatorio.observacao}</small>
              </div>
              <footer className={styles.cardActions}>
                <button
                  type="button"
                  className={styles.previewButton}
                  onClick={() => visualizarRelatorio(relatorio)}
                  disabled={Boolean(loadingAction)}
                >
                  <FaEye aria-hidden="true" />
                  {previewLoading ? "Gerando..." : "Visualizar"}
                </button>
                <button
                  type="button"
                  className={styles.downloadButton}
                  onClick={() => baixarRelatorio(relatorio)}
                  disabled={Boolean(loadingAction)}
                  aria-label={`Baixar ${relatorio.titulo}`}
                  title="Baixar PDF"
                >
                  <FaDownload aria-hidden="true" />
                  <span>{downloadLoading ? "Gerando..." : "Baixar"}</span>
                </button>
              </footer>
            </article>
          );
        })}
      </section>

      {modalOpen && relatorioAtivo && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              fecharModal();
            }
          }}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-preview-title"
          >
            <header className={styles.modalHeader}>
              <div>
                <span>Pre-visualizacao</span>
                <h2 id="report-preview-title">{relatorioAtivo.titulo}</h2>
              </div>
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.modalDownload}
                  onClick={baixarRelatorioAtivo}
                  disabled={!pdfBlob}
                >
                  <FaDownload aria-hidden="true" />
                  Baixar PDF
                </button>
                <button
                  type="button"
                  className={styles.closeButton}
                  onClick={fecharModal}
                  aria-label="Fechar pre-visualizacao"
                  title="Fechar"
                >
                  <FaTimes aria-hidden="true" />
                </button>
              </div>
            </header>

            <div className={styles.previewArea} aria-busy={Boolean(loadingAction)}>
              {loadingAction ? (
                <div className={styles.previewFeedback}>
                  <span className={styles.spinner} aria-hidden="true" />
                  <p>Montando relatorio...</p>
                </div>
              ) : error ? (
                <div className={styles.previewFeedback} role="alert">
                  <p>{error}</p>
                  <button type="button" onClick={() => visualizarRelatorio(relatorioAtivo)}>
                    Tentar novamente
                  </button>
                </div>
              ) : pdfBlob ? (
                <Suspense
                  fallback={(
                    <div className={styles.previewFeedback} role="status">
                      <span className={styles.spinner} aria-hidden="true" />
                      <p>Preparando visualizador...</p>
                    </div>
                  )}
                >
                  <PdfPreview file={pdfBlob} title={relatorioAtivo.titulo} />
                </Suspense>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
