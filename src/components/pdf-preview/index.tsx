import { useEffect, useRef, useState } from "react";
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import styles from "./style.module.css";
import { useNotification } from "@/context/NotificationContext";

GlobalWorkerOptions.workerSrc = pdfWorker;

type PdfPreviewProps = {
  file: Blob;
  title: string;
};

async function renderPage(
  page: PDFPageProxy,
  availableWidth: number,
  className: string,
) {
  const baseViewport = page.getViewport({ scale: 1 });
  const cssScale = Math.min(1.5, availableWidth / baseViewport.width);
  const viewport = page.getViewport({ scale: cssScale });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    throw new Error("Canvas indisponivel para renderizar o PDF.");
  }

  canvas.width = Math.floor(viewport.width * pixelRatio);
  canvas.height = Math.floor(viewport.height * pixelRatio);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  canvas.setAttribute("aria-label", `Pagina ${page.pageNumber}`);

  await page.render({
    canvas,
    canvasContext: context,
    viewport,
    transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
  }).promise;

  const wrapper = document.createElement("div");
  wrapper.className = className;
  wrapper.appendChild(canvas);
  return wrapper;
}

export default function PdfPreview({ file, title }: PdfPreviewProps) {
  const { showNotification } = useNotification();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const previewContainer: HTMLDivElement = container;

    let disposed = false;
    let renderVersion = 0;
    let documentProxy: PDFDocumentProxy | null = null;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    let resizeTimer: number | undefined;

    async function renderDocument() {
      if (!documentProxy || disposed) return;

      const currentVersion = ++renderVersion;
      const availableWidth = Math.max(240, previewContainer.clientWidth - 16);
      const fragment = document.createDocumentFragment();
      setLoading(true);

      for (let pageNumber = 1; pageNumber <= documentProxy.numPages; pageNumber += 1) {
        const page = await documentProxy.getPage(pageNumber);
        const pageElement = await renderPage(page, availableWidth, styles.page);

        if (disposed || currentVersion !== renderVersion) return;
        fragment.appendChild(pageElement);
      }

      previewContainer.replaceChildren(fragment);
      setLoading(false);
    }

    void file.arrayBuffer()
      .then((buffer) => {
        if (disposed) return null;
        loadingTask = getDocument({
          data: new Uint8Array(buffer),
        });
        return loadingTask.promise;
      })
      .then((pdf) => {
        if (!pdf) return;
        if (disposed) {
          void loadingTask?.destroy();
          return;
        }

        documentProxy = pdf;
        setError("");
        return renderDocument();
      })
      .catch(() => {
        if (!disposed) {
          const message = "Nao foi possivel exibir este PDF.";
          setLoading(false);
          setError(message);
          showNotification({ type: "error", title: "Pre-visualizacao indisponivel", message });
        }
      });

    const resizeObserver = new ResizeObserver(() => {
      if (!documentProxy || disposed) return;
      if (resizeTimer !== undefined) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => void renderDocument(), 120);
    });
    resizeObserver.observe(previewContainer);

    return () => {
      disposed = true;
      renderVersion += 1;
      resizeObserver.disconnect();
      if (resizeTimer !== undefined) window.clearTimeout(resizeTimer);
      void loadingTask?.destroy();
    };
  }, [file, showNotification]);

  return (
    <div className={styles.preview} aria-label={`PDF - ${title}`}>
      {loading && (
        <div className={styles.feedback} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          <p>Preparando paginas...</p>
        </div>
      )}
      {error && (
        <div className={styles.feedback} role="alert">
          <p>{error}</p>
        </div>
      )}
      <div ref={containerRef} className={styles.pages} hidden={Boolean(error)} />
    </div>
  );
}
