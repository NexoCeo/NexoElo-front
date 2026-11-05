import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./style.module.css";

const OUTPUT_SIZE = 640;
// Um enquadramento inicial ligeiramente ampliado deixa margem para arrastar
// mesmo quando a imagem original ja e quadrada.
const INITIAL_ZOOM = 1.25;

type Props = {
  source: string;
  filename: string;
  onApply: (file: File) => void;
  onCancel: () => void;
};

export default function ServiceImageCrop({ source, filename, onApply, onCancel }: Props) {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState(280);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; startX: number; startY: number } | null>(null);

  useEffect(() => {
    setImageSize({ width: 0, height: 0 });
    setZoom(INITIAL_ZOOM);
    setPosition({ x: 0, y: 0 });
    setError("");
  }, [source]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateSize = () => setViewportSize(viewport.clientWidth || 280);
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => { document.body.style.overflow = oldOverflow; };
  }, []);

  useEffect(() => {
    setPosition(current => {
      const scale = imageSize.width && imageSize.height
        ? Math.max(viewportSize / imageSize.width, viewportSize / imageSize.height) * zoom : 1;
      return {
        x: Math.max(-Math.max(0, (imageSize.width * scale - viewportSize) / 2),
          Math.min(Math.max(0, (imageSize.width * scale - viewportSize) / 2), current.x)),
        y: Math.max(-Math.max(0, (imageSize.height * scale - viewportSize) / 2),
          Math.min(Math.max(0, (imageSize.height * scale - viewportSize) / 2), current.y)),
      };
    });
  }, [imageSize.width, imageSize.height, viewportSize, zoom]);

  const baseScale = imageSize.width && imageSize.height
    ? Math.max(viewportSize / imageSize.width, viewportSize / imageSize.height)
    : 1;
  const displayedWidth = imageSize.width * baseScale * zoom;
  const displayedHeight = imageSize.height * baseScale * zoom;
  const maxX = Math.max(0, (displayedWidth - viewportSize) / 2);
  const maxY = Math.max(0, (displayedHeight - viewportSize) / 2);
  const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

  const move = (x: number, y: number) =>
    setPosition({ x: clamp(x, maxX), y: clamp(y, maxY) });

  function changeZoom(nextZoom: number) {
    const next = Math.max(1, Math.min(3, nextZoom));
    const nextWidth = imageSize.width * baseScale * next;
    const nextHeight = imageSize.height * baseScale * next;
    setZoom(next);
    setPosition((current) => ({
      x: clamp(current.x, Math.max(0, (nextWidth - viewportSize) / 2)),
      y: clamp(current.y, Math.max(0, (nextHeight - viewportSize) / 2)),
    }));
  }

  async function applyCrop() {
    const image = imageRef.current;
    if (!image?.complete || !image.naturalWidth || !image.naturalHeight || processing) return;
    setProcessing(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas indisponível.");
      const ratio = OUTPUT_SIZE / viewportSize;
      context.drawImage(
        image,
        ((viewportSize - displayedWidth) / 2 + position.x) * ratio,
        ((viewportSize - displayedHeight) / 2 + position.y) * ratio,
        displayedWidth * ratio,
        displayedHeight * ratio,
      );
      const blob = await new Promise<Blob>((resolve, reject) => {
        try {
          canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Falha ao processar imagem.")), "image/webp", 0.9);
        } catch (cause) {
          reject(cause);
        }
      });
      const name = (filename.replace(/\.[^.]+$/, "") || "servico") + "-recortada.webp";
      onApply(new File([blob], name, { type: "image/webp" }));
    } catch {
      setError("Não foi possível recortar esta imagem. Se ela já estava cadastrada, selecione o arquivo novamente.");
    } finally {
      setProcessing(false);
    }
  }

  return createPortal(
    <div className={styles.cropOverlay} role="presentation">
      <section className={styles.cropDialog} role="dialog" aria-modal="true" aria-label="Ajustar recorte da imagem">
        <header className={styles.cropDialogHeader}>
          <div><h2>Ajustar imagem</h2><p>Posicione e amplie a foto no quadrado.</p></div>
          <button ref={closeButtonRef} type="button" aria-label="Fechar recorte" onClick={onCancel}>×</button>
        </header>
        <div className={styles.cropEditor}>
      <p className={styles.cropHint}>Arraste a foto para posicionar e use o controle para ajustar o zoom.</p>
      <div ref={viewportRef} className={styles.cropViewport}
        aria-label="Área de recorte quadrado da imagem. Arraste para reposicionar ou use as setas do teclado."
        role="group"
        tabIndex={0}
        onKeyDown={(event) => {
          const offsets: Record<string, [number, number]> = {
            ArrowLeft: [-10, 0],
            ArrowRight: [10, 0],
            ArrowUp: [0, -10],
            ArrowDown: [0, 10],
          };
          const delta = offsets[event.key];
          if (!delta || !imageSize.width) return;
          event.preventDefault();
          move(position.x + delta[0], position.y + delta[1]);
        }}
        onPointerDown={(event) => {
          if (!imageSize.width || processing || (event.pointerType === "mouse" && event.button !== 0)) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: position.x, startY: position.y };
        }}
        onPointerMove={(event) => {
          if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
          move(dragRef.current.startX + event.clientX - dragRef.current.x,
            dragRef.current.startY + event.clientY - dragRef.current.y);
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.pointerId !== event.pointerId) return;
          dragRef.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { dragRef.current = null; }}
      >
        <img
          ref={imageRef}
          src={source}
          crossOrigin={source.startsWith("blob:") || source.startsWith("data:") ? undefined : "anonymous"}
          alt="Prévia do recorte"
          draggable={false}
          onLoad={(event) => {
            setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
            setError("");
          }}
          onError={() => setError("Não foi possível carregar a imagem. Escolha outro arquivo.")}
          style={imageSize.width ? {
            width: displayedWidth,
            height: displayedHeight,
            left: `calc(50% + ${position.x}px)`,
            top: `calc(50% + ${position.y}px)`,
          } : { opacity: 0 }}
        />
      </div>
      <label className={styles.cropZoomLabel} htmlFor="service-image-zoom">
        Zoom <span>{Math.round(zoom * 100)}%</span>
      </label>
      <input
        id="service-image-zoom"
        className={styles.cropZoom}
        type="range"
        min="1"
        max="3"
        step="0.05"
        value={zoom}
        aria-label="Zoom da imagem"
        onChange={(event) => changeZoom(Number(event.target.value))}
        disabled={!imageSize.width || processing}
      />
      {error && <p role="alert" className={styles.cropError}>{error}</p>}
      <div className={styles.cropActions}>
        <button type="button" onClick={onCancel} disabled={processing}>Cancelar recorte</button>
        <button type="button" onClick={() => void applyCrop()} disabled={!imageSize.width || processing}>
          {processing ? "Processando..." : "Aplicar recorte"}
        </button>
      </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
