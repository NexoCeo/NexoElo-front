import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaCalendarAlt,
  FaCheck,
  FaEnvelope,
  FaHistory,
  FaHome,
  FaPhoneAlt,
  FaPlus,
  FaSignOutAlt,
  FaSyncAlt,
  FaTimes,
  FaUser,
} from "react-icons/fa";
import type { IconType } from "react-icons";
import { isAxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import {
  atualizarStatusAgendamento,
  listarHistoricoAgendamentos,
} from "@/services/agendamento-service";
import { getClienteFinalUser } from "@/services/cliente-final-auth-token";
import { logout } from "@/services/logout-service";
import { useNotification } from "@/context/NotificationContext";
import type { Agendamento } from "@/types/agendamento";
import styles from "./style.module.css";

type HomeSection = "home" | "historico" | "perfil";

type ApiError = {
  erro?: string;
  message?: string;
  title?: string;
};

type StatusFeedback = {
  kind: "success" | "error";
  text: string;
};

const CANCELLATION_LIMIT_MS = 2 * 60 * 60 * 1000;
const CANCELLATION_LIMIT_MESSAGE =
  "Limite de prazo atingido, o agendamento não pode ser cancelado.";

const navigationItems: Array<{
  id: HomeSection;
  label: string;
  Icon: IconType;
}> = [
  { id: "home", label: "Home", Icon: FaHome },
  { id: "historico", label: "Histórico", Icon: FaHistory },
  { id: "perfil", label: "Perfil", Icon: FaUser },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatAppointmentDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatAppointmentTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPhone(value?: string) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length !== 11) return value || "Não informado";
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function statusLabel(value: string) {
  const normalizedStatus = value.trim().toUpperCase();
  if (normalizedStatus === "CONCLUIDO" || normalizedStatus === "CONCLUÍDO") return "Concluído";
  if (normalizedStatus === "CANCELADO") return "Cancelado";
  if (normalizedStatus === "CONFIRMADO") return "Confirmado";
  return "Agendado";
}

function statusClass(value: string) {
  const normalizedStatus = value.trim().toUpperCase();
  if (normalizedStatus === "CONCLUIDO" || normalizedStatus === "CONCLUÍDO") return styles.completed;
  if (normalizedStatus === "CANCELADO") return styles.cancelled;
  return styles.scheduled;
}

function isScheduled(appointment: Agendamento) {
  return appointment.Status.trim().toUpperCase() === "AGENDADO";
}

function getApiError(error: unknown) {
  if (!isAxiosError<ApiError>(error)) {
    return "Não foi possível atualizar o agendamento.";
  }

  const data = error.response?.data;
  return data?.erro || data?.message || data?.title || "Não foi possível atualizar o agendamento.";
}

function isUpcoming(appointment: Agendamento) {
  const status = appointment.Status.trim().toUpperCase();
  return (
    new Date(appointment.DataAgendamento).getTime() >= Date.now() &&
    status !== "CANCELADO" &&
    status !== "CONCLUIDO" &&
    status !== "CONCLUÍDO"
  );
}

function AppointmentCard({
  appointment,
  updatingId,
  onStatusChange,
}: {
  appointment: Agendamento;
  updatingId: number | null;
  onStatusChange: (agendamentoId: number, status: "CANCELADO" | "CONCLUIDO") => void;
}) {
  return (
    <article className={styles.appointmentCard}>
      <div className={styles.appointmentDate}>
        <FaCalendarAlt aria-hidden="true" />
        <div>
          <time dateTime={appointment.DataAgendamento}>
            {formatAppointmentDate(appointment.DataAgendamento)}
          </time>
          <strong>{formatAppointmentTime(appointment.DataAgendamento)}</strong>
        </div>
      </div>

      <div className={styles.appointmentMain}>
        <strong>{appointment.ServicoNome || `Serviço #${appointment.ServicoId}`}</strong>
        <span>{appointment.ProfissionalNome || "Profissional não informado"}</span>
      </div>

      <div className={styles.appointmentMeta}>
        <span className={`${styles.statusBadge} ${statusClass(appointment.Status)}`}>
          {statusLabel(appointment.Status)}
        </span>
        <strong>{formatCurrency(appointment.ValorServico || appointment.Valor || 0)}</strong>
      </div>

      {isScheduled(appointment) && (
        <div className={styles.appointmentActions} aria-label="Ações do agendamento">
          <button
            type="button"
            className={styles.cancelAction}
            onClick={() => onStatusChange(appointment.Id, "CANCELADO")}
            disabled={updatingId === appointment.Id}
            title="Cancelar agendamento"
            aria-label={`Cancelar agendamento de ${appointment.ServicoNome || `serviço ${appointment.ServicoId}`}`}
          >
            <FaTimes aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.completeAction}
            onClick={() => onStatusChange(appointment.Id, "CONCLUIDO")}
            disabled={updatingId === appointment.Id}
            title="Concluir agendamento"
            aria-label={`Concluir agendamento de ${appointment.ServicoNome || `serviço ${appointment.ServicoId}`}`}
          >
            <FaCheck aria-hidden="true" />
          </button>
        </div>
      )}
    </article>
  );
}

export default function ClienteFinalHome() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const cliente = getClienteFinalUser();
  const [activeSection, setActiveSection] = useState<HomeSection>("home");
  const [appointments, setAppointments] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<StatusFeedback | null>(null);

  const loadAppointments = useCallback(async () => {
    if (!cliente?.Id) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await listarHistoricoAgendamentos(cliente.Id);
      setAppointments(data);
      setError("");
    } catch {
      const message = "Não foi possível carregar seus agendamentos.";
      setError(message);
      showNotification({ type: "error", title: "Histórico indisponível", message });
    } finally {
      setLoading(false);
    }
  }, [cliente?.Id, showNotification]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const upcomingAppointments = useMemo(
    () => appointments.filter(isUpcoming).sort(
      (a, b) => new Date(a.DataAgendamento).getTime() - new Date(b.DataAgendamento).getTime(),
    ),
    [appointments],
  );

  const previousAppointments = useMemo(
    () => appointments.filter((appointment) => !isUpcoming(appointment)).sort(
      (a, b) => new Date(b.DataAgendamento).getTime() - new Date(a.DataAgendamento).getTime(),
    ),
    [appointments],
  );

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // The local session must still end when the API is unavailable.
    } finally {
      showNotification({
        type: "success",
        title: "Sessão encerrada",
        message: "Você saiu da sua conta com segurança.",
      });
      navigate("/cliente-final/login");
    }
  }

  async function handleStatusChange(
    agendamentoId: number,
    status: "CANCELADO" | "CONCLUIDO",
  ) {
    setStatusFeedback(null);

    const appointment = appointments.find((item) => item.Id === agendamentoId);
    const appointmentTime = appointment
      ? new Date(appointment.DataAgendamento).getTime()
      : Number.NaN;

    if (
      status === "CANCELADO" &&
      Number.isFinite(appointmentTime) &&
      Date.now() > appointmentTime - CANCELLATION_LIMIT_MS
    ) {
      setStatusFeedback({ kind: "error", text: CANCELLATION_LIMIT_MESSAGE });
      showNotification({
        type: "warning",
        title: "Prazo de cancelamento encerrado",
        message: CANCELLATION_LIMIT_MESSAGE,
      });
      return;
    }

    setUpdatingId(agendamentoId);

    try {
      const updated = await atualizarStatusAgendamento(agendamentoId, status);
      setAppointments((items) => items.map((item) => (
        item.Id === agendamentoId ? { ...item, ...updated } : item
      )));
      setStatusFeedback({
        kind: "success",
        text: status === "CANCELADO"
          ? "Agendamento cancelado."
          : "Agendamento concluído.",
      });
      showNotification({
        type: "success",
        title: status === "CANCELADO" ? "Agendamento cancelado" : "Agendamento concluído",
        message: status === "CANCELADO"
          ? "O horário foi liberado e seu histórico foi atualizado."
          : "O atendimento foi marcado como concluído.",
      });
    } catch (statusError) {
      const message = getApiError(statusError);
      setStatusFeedback({ kind: "error", text: message });
      showNotification({ type: "error", title: "Agendamento não atualizado", message });
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <button
            type="button"
            className={styles.brand}
            onClick={() => setActiveSection("home")}
            aria-label="Ir para a home"
          >
            <span aria-hidden="true">CF</span>
            <strong>Cliente final</strong>
          </button>

          <nav className={styles.navigation} aria-label="Navegação do cliente" role="tablist">
            {navigationItems.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-controls={`panel-${id}`}
                aria-selected={activeSection === id}
                className={activeSection === id ? styles.activeNavItem : undefined}
                onClick={() => setActiveSection(id)}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <button type="button" className={styles.logoutButton} onClick={() => void handleLogout()}>
            <FaSignOutAlt aria-hidden="true" />
            <span>Sair</span>
          </button>
        </div>
      </header>

      <main className={styles.content}>
        {statusFeedback && (
          <div
            className={`${styles.statusFeedback} ${styles[statusFeedback.kind]}`}
            role={statusFeedback.kind === "error" ? "alert" : "status"}
          >
            {statusFeedback.text}
          </div>
        )}

        {activeSection === "home" && (
          <section
            id="panel-home"
            role="tabpanel"
            aria-labelledby="tab-home"
            className={styles.view}
          >
            <header className={styles.pageHeader}>
              <div>
                <span>Cliente final</span>
                <h1>Olá, {cliente?.Nome || "cliente"}</h1>
              </div>
              <button type="button" className={styles.primaryButton} onClick={() => navigate("/cliente-final/agendar")}>
                <FaPlus aria-hidden="true" />
                Novo agendamento
              </button>
            </header>

            <div className={styles.summaryGrid} aria-label="Resumo dos agendamentos">
              <div>
                <span>Próximos</span>
                <strong>{upcomingAppointments.length}</strong>
              </div>
              <div>
                <span>Anteriores</span>
                <strong>{previousAppointments.length}</strong>
              </div>
            </div>

            <section className={styles.sectionBlock} aria-labelledby="next-appointment-title">
              <div className={styles.sectionHeading}>
                <div>
                  <span>Agenda</span>
                  <h2 id="next-appointment-title">Próximo atendimento</h2>
                </div>
                {upcomingAppointments.length > 1 && (
                  <button type="button" className={styles.textButton} onClick={() => setActiveSection("historico")}>
                    Ver todos
                  </button>
                )}
              </div>

              {loading ? (
                <div className={styles.feedback} role="status">Carregando agendamentos...</div>
              ) : error ? (
                <div className={styles.feedback} role="alert">
                  <span>{error}</span>
                  <button type="button" onClick={() => void loadAppointments()}>Tentar novamente</button>
                </div>
              ) : upcomingAppointments[0] ? (
                <AppointmentCard
                  appointment={upcomingAppointments[0]}
                  updatingId={updatingId}
                  onStatusChange={handleStatusChange}
                />
              ) : (
                <div className={styles.emptyState}>
                  <FaCalendarAlt aria-hidden="true" />
                  <div>
                    <strong>Nenhum atendimento agendado</strong>
                    <span>Escolha um serviço e encontre o melhor horário.</span>
                  </div>
                  <button type="button" onClick={() => navigate("/cliente-final/agendar")}>Agendar</button>
                </div>
              )}
            </section>
          </section>
        )}

        {activeSection === "historico" && (
          <section
            id="panel-historico"
            role="tabpanel"
            aria-labelledby="tab-historico"
            className={styles.view}
          >
            <header className={styles.pageHeader}>
              <div>
                <span>Agendamentos</span>
                <h1>Histórico</h1>
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => void loadAppointments()}
                disabled={loading}
              >
                <FaSyncAlt className={loading ? styles.rotating : undefined} aria-hidden="true" />
                Atualizar
              </button>
            </header>

            {loading ? (
              <div className={styles.feedback} role="status">Carregando histórico...</div>
            ) : error ? (
              <div className={styles.feedback} role="alert">
                <span>{error}</span>
                <button type="button" onClick={() => void loadAppointments()}>Tentar novamente</button>
              </div>
            ) : appointments.length === 0 ? (
              <div className={styles.emptyState}>
                <FaHistory aria-hidden="true" />
                <div>
                  <strong>Seu histórico está vazio</strong>
                  <span>Seus agendamentos aparecerão aqui.</span>
                </div>
              </div>
            ) : (
              <div className={styles.historyGroups}>
                {upcomingAppointments.length > 0 && (
                  <section aria-labelledby="upcoming-title">
                    <div className={styles.listTitle}>
                      <h2 id="upcoming-title">Próximos</h2>
                      <span>{upcomingAppointments.length}</span>
                    </div>
                    <div className={styles.appointmentList}>
                      {upcomingAppointments.map((appointment) => (
                        <AppointmentCard
                          key={appointment.Id}
                          appointment={appointment}
                          updatingId={updatingId}
                          onStatusChange={handleStatusChange}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {previousAppointments.length > 0 && (
                  <section aria-labelledby="previous-title">
                    <div className={styles.listTitle}>
                      <h2 id="previous-title">Anteriores</h2>
                      <span>{previousAppointments.length}</span>
                    </div>
                    <div className={styles.appointmentList}>
                      {previousAppointments.map((appointment) => (
                        <AppointmentCard
                          key={appointment.Id}
                          appointment={appointment}
                          updatingId={updatingId}
                          onStatusChange={handleStatusChange}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </section>
        )}

        {activeSection === "perfil" && (
          <section
            id="panel-perfil"
            role="tabpanel"
            aria-labelledby="tab-perfil"
            className={styles.view}
          >
            <header className={styles.pageHeader}>
              <div>
                <span>Sua conta</span>
                <h1>Perfil</h1>
              </div>
            </header>

            <section className={styles.profilePanel} aria-labelledby="profile-name">
              <div className={styles.profileIdentity}>
                <span className={styles.avatar} aria-hidden="true">
                  {(cliente?.Nome || "C").trim().charAt(0).toUpperCase()}
                </span>
                <div>
                  <span>Cliente</span>
                  <h2 id="profile-name">{cliente?.Nome || "Cliente"}</h2>
                </div>
              </div>

              <dl className={styles.profileDetails}>
                <div>
                  <dt><FaEnvelope aria-hidden="true" /> E-mail</dt>
                  <dd>{cliente?.Email?.toLowerCase() || "Não informado"}</dd>
                </div>
                <div>
                  <dt><FaPhoneAlt aria-hidden="true" /> Telefone</dt>
                  <dd>{formatPhone(cliente?.Telefone)}</dd>
                </div>
              </dl>
            </section>
          </section>
        )}
      </main>
    </div>
  );
}
