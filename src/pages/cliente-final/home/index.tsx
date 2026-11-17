import LoadingState from "@/components/loading-state";
import logoNexoCeo from "@/assets/logoNexoCeo.png";
import { createAgendaRealtimeClient } from "@/services/agenda-realtime-service";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaCalendarAlt,
  FaCheck,
  FaCheckCircle,
  FaClock,
  FaCut,
  FaHistory,
  FaHome,
  FaPlus,
  FaSignOutAlt,
  FaTag,
  FaTimes,
  FaTimesCircle,
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
import { consultarPagamentoAgendamento, iniciarPagamentoOnline, type EstadoPagamento } from "@/services/pagamentos-agendamento-service";
import { logout } from "@/services/logout-service";
import { useNotification } from "@/context/NotificationContext";
import type { Agendamento } from "@/types/agendamento";
import styles from "./style.module.css";
import { formatPersonName, formatEmailDisplay } from "@/context/UserContext";
import ProfileOverview from "@/components/profile-overview";
import { useLanguage } from "@/context/LanguageContext";
import { usePageRevalidation } from "@/hooks/usePageRevalidation";

type HomeSection = "home" | "historico" | "perfil";
type HistoryStatusFilter = "all" | "completed" | "cancelled";

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
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
  return formatted.charAt(0).toLocaleUpperCase("pt-BR") + formatted.slice(1);
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
  // O início do horário não encerra o agendamento: somente o status final
  // o transfere para Anteriores. Assim, atrasos não ocultam reservas ativas.
  return status !== "CANCELADO" &&
    status !== "CONCLUIDO" &&
    status !== "CONCLUÍDO" &&
    status !== "ENCERRADO";
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
  const [payment, setPayment] = useState<EstadoPagamento | null>(null);
  const [openingPayment, setOpeningPayment] = useState(false);
  const { showNotification } = useNotification();

  useEffect(() => {
    if (!isScheduled(appointment)) return;
    let active = true;
    void consultarPagamentoAgendamento(appointment.Id)
      .then(data => { if (active) setPayment(data); })
      .catch(() => { if (active) setPayment(null); });
    return () => { active = false; };
  }, [appointment.Id, appointment.Status]);

  async function retomarPagamento() {
    try {
      setOpeningPayment(true);
      await iniciarPagamentoOnline(appointment.Id);
    } catch {
      showNotification({
        type: "error",
        title: "Não foi possível abrir o pagamento",
        message: "Tente novamente ou entre em contato com o estabelecimento.",
      });
      setOpeningPayment(false);
    }
  }

  return (
    <article className={styles.appointmentCard}>
      <div className={styles.appointmentTopRow}>
        <div className={styles.appointmentDate}>
          <span className={styles.appointmentIcon}><FaCalendarAlt aria-hidden="true" /></span>
          <div className={styles.appointmentDateInfo}>
            <time dateTime={appointment.DataAgendamento}>{formatAppointmentDate(appointment.DataAgendamento)}</time>
            <strong>{formatAppointmentTime(appointment.DataAgendamento)}</strong>
          </div>
        </div>
        <span className={`${styles.statusBadge} ${statusClass(appointment.Status)}`}>{statusLabel(appointment.Status)}</span>
      </div>

      <div className={styles.appointmentService}>
        <span className={styles.appointmentIcon}><FaCut aria-hidden="true" /></span>
        <div className={styles.appointmentServiceInfo}>
          <strong>{appointment.ServicoNome || `Serviço #${appointment.ServicoId}`}</strong>
          <span>
            <FaUser aria-hidden="true" />
            <span>Profissionais: {formatPersonName(appointment.ProfissionalNome) || "Não informado"}</span>
          </span>
        </div>
      </div>

      <div className={styles.appointmentMetrics}>
        <div className={styles.appointmentMetric}>
          <span className={styles.metricIcon}><FaTag aria-hidden="true" /></span>
          <div className={styles.metricInfo}>
            <span>Valor total</span>
            <strong>{formatCurrency(appointment.ValorServico || appointment.Valor || 0)}</strong>
          </div>
        </div>
        <div className={styles.appointmentMetric}>
          <span className={styles.metricIcon}><FaClock aria-hidden="true" /></span>
          <div className={styles.metricInfo}>
            <span>Duração</span>
            <strong>{appointment.DuracaoMinutos && appointment.DuracaoMinutos > 0 ? `${appointment.DuracaoMinutos} min` : "Não informada"}</strong>
          </div>
        </div>
      </div>

      {payment && (
        <div className={styles.paymentStatus}>
          {payment.status === "PAGO" ? <span>Pagamento confirmado</span> :
           payment.status === "PENDENTE" && payment.metodo === "PRESENCIAL" ?
            <span>Pagamento presencial pendente</span> :
           payment.metodo === "ONLINE" && payment.status === "PENDENTE" ?
            <button type="button" disabled={openingPayment} onClick={() => void retomarPagamento()}>
              {openingPayment ? "Abrindo checkout..." : "Continuar pagamento online"}
            </button> : null}
        </div>
      )}

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
            <span>Cancelar</span>
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
            <span>Concluir</span>
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
  const [historyFilter, setHistoryFilter] = useState<HistoryStatusFilter>("all");
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
    return () => {
      requestGeneration.current += 1;
      requestPending.current = false;
      window.clearInterval(interval);
      void realtime?.stop();
    };
  }, [loadAppointments, cliente?.Id]);

  usePageRevalidation(() => loadAppointments(true), { enabled: Boolean(cliente?.Id) && updatingId === null, pollIntervalMs: 0 });

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

  // Mantém os grupos de histórico, aplicando o status selecionado apenas à listagem.
  const filteredHistoryUpcoming = historyFilter === "all" ? upcomingAppointments : [];
  const filteredHistoryPrevious = useMemo(
    () => previousAppointments.filter((appointment) => {
      if (historyFilter === "all") return true;
      const status = appointment.Status.trim().toUpperCase();
      return historyFilter === "completed"
        ? status === "CONCLUIDO" || status === "CONCLUÍDO"
        : status === "CANCELADO";
    }),
    [previousAppointments, historyFilter],
  );

  // O resumo contabiliza somente atendimentos concluídos, sem incluir cancelamentos.
  const completedAppointmentsCount = useMemo(
    () => appointments.filter((appointment) => {
      const status = appointment.Status.trim().toUpperCase();
      return status === "CONCLUIDO" || status === "CONCLUÍDO";
    }).length,
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
          <div className={styles.brand}>
            <img src={logoNexoCeo} alt="" aria-hidden="true" />
            <strong>NexoCeo</strong>
          </div>
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
        {activeSection === "home" && (
          <h1 className={styles.greeting}>Olá, {formatPersonName(cliente?.Nome) || "cliente"}</h1>
        )}
        {statusFeedback?.kind === "success" && (
          <div
            className={`${styles.statusFeedback} ${styles.success}`}
            role="status"
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
            <header className={`${styles.pageHeader} ${styles.bookingHeader}`}>
              <button type="button" className={styles.primaryButton} onClick={() => navigate("/cliente-final/agendar")}>
                <FaPlus aria-hidden="true" />
                Novo agendamento
              </button>
            </header>

            <div className={styles.summaryGrid} aria-label="Resumo dos agendamentos">
              <div className={styles.summaryCard}>
                <span className={`${styles.summaryIcon} ${styles.summaryIconUpcoming}`} aria-hidden="true">
                  <FaCalendarAlt />
                </span>
                <div className={styles.summaryDetails}>
                  <span className={styles.summaryLabel}>{t("client.summaryUpcoming")}</span>
                  <strong>{upcomingAppointments.length}</strong>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <span className={`${styles.summaryIcon} ${styles.summaryIconCompleted}`} aria-hidden="true">
                  <FaCheckCircle />
                </span>
                <div className={styles.summaryDetails}>
                  <span className={styles.summaryLabel}>{t("client.summaryCompleted")}</span>
                  <strong>{completedAppointmentsCount}</strong>
                </div>
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
                <LoadingState label={t("client.loading")} variant="client-home" embedded />
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
            <div className={styles.historyIntro}>
              <header className={styles.pageHeader}>
                <div>
                  <h1>{lang === "pt" ? "Histórico de Agendamentos" : "Appointment History"}</h1>
                </div>
              </header>
              <div className={styles.historyFilters} role="group" aria-label={t("client.historyStatusFilters")}>
                <button
                  type="button"
                  className={`${styles.historyFilterButton} ${historyFilter === "all" ? styles.historyFilterActive : ""}`}
                  aria-pressed={historyFilter === "all"}
                  onClick={() => setHistoryFilter("all")}
                >
                  {t("client.filterAll")}
                </button>
                <button
                  type="button"
                  className={`${styles.historyFilterButton} ${styles.historyFilterCompleted} ${historyFilter === "completed" ? styles.historyFilterActive : ""}`}
                  aria-pressed={historyFilter === "completed"}
                  onClick={() => setHistoryFilter("completed")}
                >
                  <FaCheckCircle aria-hidden="true" />
                  {t("client.filterCompleted")}
                </button>
                <button
                  type="button"
                  className={`${styles.historyFilterButton} ${styles.historyFilterCancelled} ${historyFilter === "cancelled" ? styles.historyFilterActive : ""}`}
                  aria-pressed={historyFilter === "cancelled"}
                  onClick={() => setHistoryFilter("cancelled")}
                >
                  <FaTimesCircle aria-hidden="true" />
                  {t("client.filterCancelled")}
                </button>
              </div>
            </div>

            {loading ? (
              <LoadingState label={t("client.historyLoading")} variant="client-history" embedded />
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
            ) : filteredHistoryUpcoming.length === 0 && filteredHistoryPrevious.length === 0 ? (
              <div className={styles.emptyState}>
                <FaHistory aria-hidden="true" />
                <div>
                  <strong>{t(historyFilter === "completed"
                    ? "client.noCompletedAppointments"
                    : "client.noCancelledAppointments")}</strong>
                </div>
              </div>
            ) : (
              <div className={styles.historyGroups}>
                {filteredHistoryUpcoming.length > 0 && (
                  <section aria-labelledby="upcoming-title">
                    <div className={styles.listTitle}>
                      <h2 id="upcoming-title">{t("client.upcoming")}</h2>
                      <span>{filteredHistoryUpcoming.length}</span>
                    </div>
                    <div className={styles.appointmentList}>
                      {filteredHistoryUpcoming.map((appointment) => (
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

                {filteredHistoryPrevious.length > 0 && (
                  <section aria-labelledby="previous-title">
                    <div className={styles.listTitle}>
                      <h2 id="previous-title">{t("client.previous")}</h2>
                      <span>{filteredHistoryPrevious.length}</span>
                    </div>
                    <div className={styles.appointmentList}>
                      {filteredHistoryPrevious.map((appointment) => (
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
              name={formatPersonName(cliente?.Nome) || "Cliente"}
              role="Cliente"
              email={formatEmailDisplay(cliente?.Email)}
              phone={cliente?.Telefone}
            />
          </section>
        )}
      </main>
    </div>
  );
}
