import { createAgendaRealtimeClient } from "@/services/agenda-realtime-service";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaCalendarAlt,
  FaCheck,
  FaHistory,
  FaHome,
  FaPlus,
  FaSignOutAlt,
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
import ProfileOverview from "@/components/profile-overview";
import { useLanguage } from "@/context/LanguageContext";

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
  { id: "home", label: "Início", Icon: FaHome },
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
  const { t, lang } = useLanguage();
  const { showNotification } = useNotification();
  const cliente = getClienteFinalUser();
  const [activeSection, setActiveSection] = useState<HomeSection>("home");
  const [appointments, setAppointments] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<StatusFeedback | null>(null);

  const requestPending = useRef(false);
  const requestGeneration = useRef(0);

  const loadAppointments = useCallback(async (silent = false) => {
    if (requestPending.current) return;
    if (!cliente?.Id) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    requestPending.current = true;
    const generation = requestGeneration.current;
    if (!silent) setLoading(true);
    try {
      const data = await listarHistoricoAgendamentos(cliente.Id);
      if (generation !== requestGeneration.current) return;
      setAppointments(data);
      setError("");
    } catch {
      if (generation !== requestGeneration.current) return;
      setError(lang === "pt"
        ? "Aguardando conexão para atualizar seus agendamentos automaticamente."
        : "Waiting for a connection to update your appointments automatically.");
    } finally {
      if (generation === requestGeneration.current) {
        requestPending.current = false;
        setLoading(false);
      }
    }
  }, [cliente?.Id, lang]);

  useEffect(() => {
    void loadAppointments();
    const refresh = () => {
      if (document.visibilityState === "visible" && navigator.onLine !== false) {
        void loadAppointments(true);
      }
    };
    const realtime = cliente?.Id ? createAgendaRealtimeClient({
      onAgendaUpdated: refresh,
      onStatusChange: status => { if (status === "connected") refresh(); },
    }) : null;
    realtime?.start();
    const interval = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      requestGeneration.current += 1;
      requestPending.current = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
      void realtime?.stop();
    };
  }, [loadAppointments, cliente?.Id]);

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
          <nav className={styles.navigation} aria-label={t("client.navigation")} role="tablist">
            {navigationItems.map(({ id, Icon }) => (
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
                <span>{id === "home" ? t("client.home") : id === "historico" ? t("client.history") : t("client.profile")}</span>
              </button>
            ))}
          </nav>

          <button type="button" className={styles.logoutButton} onClick={() => void handleLogout()}>
            <FaSignOutAlt aria-hidden="true" />
            <span>{t("client.logout")}</span>
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
                <h1>Olá, {cliente?.Nome || "cliente"}</h1>
              </div>
              <button type="button" className={styles.primaryButton} onClick={() => navigate("/cliente-final/agendar")}>
                <FaPlus aria-hidden="true" />
                Novo agendamento
              </button>
            </header>

            <div className={styles.summaryGrid} aria-label="Resumo dos agendamentos">
              <div>
                <span>{t("client.upcoming")}</span>
                <strong>{upcomingAppointments.length}</strong>
              </div>
              <div>
                <span>{t("client.previous")}</span>
                <strong>{previousAppointments.length}</strong>
              </div>
            </div>

            <section className={styles.sectionBlock} aria-labelledby="next-appointment-title">
              <div className={styles.sectionHeading}>
                <div>
                  <h2 id="next-appointment-title">{t("client.nextAppointment")}</h2>
                </div>
                {upcomingAppointments.length > 1 && (
                  <button type="button" className={styles.textButton} onClick={() => setActiveSection("historico")}>
                    Ver todos
                  </button>
                )}
              </div>

              {loading ? (
                <div className={styles.feedback} role="status">{t("client.loading")}</div>
              ) : error && appointments.length === 0 ? (
                <div className={styles.feedback} role="alert">
                  <span>{error}</span>

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
                    <strong>{t("client.emptyUpcoming")}</strong>
                    <span>{t("client.emptyUpcomingNote")}</span>
                  </div>
                  <button type="button" onClick={() => navigate("/cliente-final/agendar")}>{t("client.book")}</button>
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
                <h1>{lang === "pt" ? "Histórico de Agendamentos" : "Appointment History"}</h1>
              </div>
            </header>

            {loading ? (
              <div className={styles.feedback} role="status">{t("client.historyLoading")}</div>
            ) : error && appointments.length === 0 ? (
              <div className={styles.feedback} role="alert">
                <span>{error}</span>

              </div>
            ) : appointments.length === 0 ? (
              <div className={styles.emptyState}>
                <FaHistory aria-hidden="true" />
                <div>
                  <strong>{t("client.historyEmpty")}</strong>
                  <span>{t("client.historyEmptyNote")}</span>
                </div>
              </div>
            ) : (
              <div className={styles.historyGroups}>
                {upcomingAppointments.length > 0 && (
                  <section aria-labelledby="upcoming-title">
                    <div className={styles.listTitle}>
                      <h2 id="upcoming-title">{t("client.upcoming")}</h2>
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
                      <h2 id="previous-title">{t("client.previous")}</h2>
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
            <ProfileOverview
              name={cliente?.Nome || "Cliente"}
              role="Cliente"
              email={cliente?.Email}
              phone={cliente?.Telefone}
            />
          </section>
        )}
      </main>
    </div>
  );
}
