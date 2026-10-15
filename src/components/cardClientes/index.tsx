import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { FaCalendarXmark, FaCheck, FaXmark } from "react-icons/fa6";
import styles from "./style.module.css";

export type AgendaCardItem = {
  Id: number;
  cliente: string;
  servico: string;
  profissional: string;
  horario: string;
  status: string;
  valor: string;
};

interface CardProps {
  agendamentos: AgendaCardItem[];
  loading: boolean;
  error: string;
  selectedDateLabel: string;
  updatingId?: number | null;
  onStatusChange?: (agendamentoId: number, status: "CANCELADO" | "CONCLUIDO") => void;
}

function statusClass(status: string) {
  const normalizedStatus = status.toUpperCase();

  if (normalizedStatus === "CONCLUIDO" || normalizedStatus === "CONCLUÍDO") {
    return styles.completed;
  }

  if (normalizedStatus === "CANCELADO") return styles.cancelled;
  return styles.scheduled;
}

export function Card({
  agendamentos,
  loading,
  error,
  selectedDateLabel,
  updatingId,
  onStatusChange,
}: CardProps) {
  const labels = ["Cliente", "Serviço", "Profissional", "Horário", "Status", "Valor", "Ações"];
  const [widths, setWidths] = useState<number[]>([20, 18, 18, 10, 12, 11, 11]);
  const listRef = useRef<HTMLDivElement>(null);
  const resizing = useRef<{ index: number; x: number; widths: number[]; containerWidth: number } | null>(null);
  const gridStyle = { "--agenda-columns": widths.map(value => "minmax(0, " + value + "fr)").join(" ") } as CSSProperties;
  function resizePair(index: number, deltaPercent: number, original: number[]) {
    const next = [...original];
    const minLeft = index < 3 ? 9 : 7;
    const minRight = index + 1 < 3 ? 9 : 7;
    const delta = Math.max(minLeft - next[index], Math.min(deltaPercent, next[index + 1] - minRight));
    next[index] += delta;
    next[index + 1] -= delta;
    setWidths(next);
  }
  function startResize(event: ReactPointerEvent<HTMLSpanElement>, index: number) {
    if (event.button !== 0 || !listRef.current) return;
    event.preventDefault();
    resizing.current = { index, x: event.clientX, widths: [...widths], containerWidth: listRef.current.getBoundingClientRect().width };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveResize(event: ReactPointerEvent<HTMLSpanElement>) {
    const drag = resizing.current;
    if (!drag) return;
    resizePair(drag.index, (event.clientX - drag.x) * 100 / drag.containerWidth, drag.widths);
  }
  function stopResize() { resizing.current = null; }
  function autoFit(index: number) {
    const root = listRef.current;
    if (!root) return;
    const available = root.clientWidth - 36;
    if (available <= 0) return;
    const cells = Array.from(root.querySelectorAll<HTMLElement>("[data-column=\"" + index + "\"]"));
    const longest = cells.reduce((result, el) => Math.max(result, (el.textContent || "").trim().length), labels[index].length);
    const desired = Math.min(31, Math.max(index < 3 ? 9 : 7, ((longest * 7.4 + 32) / available) * 100));
    if (index === 6) resizePair(5, widths[6] - desired, widths);
    else resizePair(index, desired - widths[index], widths);
  }
  return (
    <div className={styles.listSection} ref={listRef} style={gridStyle}>
      <div className={styles.listHeader}>
        {labels.map((label, index) => (
          <div className={styles.columnTitle} key={label} data-column={index}>
            <span>{label}</span>
            {index < labels.length - 1 && (
              <span className={styles.resizeHandle} role="separator" aria-label={"Redimensionar coluna " + label}
                aria-orientation="vertical" tabIndex={0}
                title="Arraste para ajustar. Clique duas vezes para ajuste automático."
                onPointerDown={event => startResize(event, index)}
                onPointerMove={moveResize} onPointerUp={stopResize} onLostPointerCapture={stopResize}
                onDoubleClick={() => autoFit(index)}
                onKeyDown={event => {
                  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    event.preventDefault();
                    resizePair(index, event.key === "ArrowRight" ? 2 : -2, widths);
                  } else if (event.key === "Enter") autoFit(index);
                }}
              />
            )}
          </div>
        ))}
      </div>

      {loading ? (
        <div className={styles.feedback} role="status">
          <span className={styles.loader} aria-hidden="true" />
          Carregando agendamentos...
        </div>
      ) : error ? (
        <div className={styles.error} role="alert">{error}</div>
      ) : agendamentos.length > 0 ? (
        <div className={styles.listBody}>
          {agendamentos.map((appointment) => (
            <article key={appointment.Id} className={styles.listItem}>
              <div className={styles.patient} data-label="Cliente" data-column={0}>
                <span className={styles.statusDot} aria-hidden="true" />
                <strong>{appointment.cliente}</strong>
              </div>
              <div data-label="Serviço" data-column={1}>{appointment.servico}</div>
              <div data-label="Profissional" data-column={2}>{appointment.profissional}</div>
              <div className={styles.time} data-label="Horário" data-column={3}>{appointment.horario}</div>
              <div data-label="Status" data-column={4}>
                <span className={`${styles.statusBadge} ${statusClass(appointment.status)}`}>
                  {appointment.status}
                </span>
              </div>
              <div className={styles.value} data-label="Valor" data-column={5}>{appointment.valor}</div>
              <div className={styles.actions} data-label="Ações" data-column={6}>
                {appointment.status.trim().toUpperCase() === "AGENDADO" && onStatusChange ? (
                  <>
                    <button
                      type="button"
                      className={`${styles.actionButton} ${styles.cancelAction}`}
                      onClick={() => onStatusChange(appointment.Id, "CANCELADO")}
                      disabled={updatingId === appointment.Id}
                      title="Cancelar agendamento"
                      aria-label={`Cancelar agendamento de ${appointment.cliente}`}
                    >
                      <FaXmark aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionButton} ${styles.completeAction}`}
                      onClick={() => onStatusChange(appointment.Id, "CONCLUIDO")}
                      disabled={updatingId === appointment.Id}
                      title="Concluir agendamento"
                      aria-label={`Concluir agendamento de ${appointment.cliente}`}
                    >
                      <FaCheck aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <span className={styles.noActions}>-</span>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <FaCalendarXmark aria-hidden="true" />
          <strong>Nenhum agendamento</strong>
          <span>{selectedDateLabel}</span>
        </div>
      )}
    </div>
  );
}
