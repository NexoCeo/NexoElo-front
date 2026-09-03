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
  return (
    <div className={styles.listSection}>
      <div className={styles.listHeader} aria-hidden="true">
        <span>Cliente</span>
        <span>Serviço</span>
        <span>Profissional</span>
        <span>Horário</span>
        <span>Status</span>
        <span>Valor</span>
        <span>Ações</span>
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
              <div className={styles.patient} data-label="Cliente">
                <span className={styles.statusDot} aria-hidden="true" />
                <strong>{appointment.cliente}</strong>
              </div>
              <div data-label="Serviço">{appointment.servico}</div>
              <div data-label="Profissional">{appointment.profissional}</div>
              <div className={styles.time} data-label="Horário">{appointment.horario}</div>
              <div data-label="Status">
                <span className={`${styles.statusBadge} ${statusClass(appointment.status)}`}>
                  {appointment.status}
                </span>
              </div>
              <div className={styles.value} data-label="Valor">{appointment.valor}</div>
              <div className={styles.actions} data-label="Ações">
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
