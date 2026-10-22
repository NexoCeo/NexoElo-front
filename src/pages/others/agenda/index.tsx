import AgendaBooking from "@/components/agenda-booking";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaPlus, FaCalendarCheck, FaCalendarDay, FaRotate } from "react-icons/fa6";
import axios from "axios";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { useNotification } from "@/context/NotificationContext";
import { Calendar, WeekCalendar } from "@/components/calendar";
import { Card, type AgendaCardItem } from "@/components/cardClientes";
import {
  atualizarStatusAgendamento,
  concluirAgendamentosDoDiaAtual,
  formatAgendaDateParam,
  listarAgendaPorData,
} from "@/services/agendamento-service";
import { listarProfissionaisEmpresa } from "@/services/profissional-service";
import {
  createAgendaRealtimeClient,
  type AgendaRealtimeStatus,
} from "@/services/agenda-realtime-service";
import type { Agendamento } from "@/types/agendamento";
import type { Profissional } from "@/types/profissional";
import styles from "./style.module.css";
import { formatPersonName } from "@/context/UserContext";
import { useLanguage } from "@/context/LanguageContext";

const REFRESH_INTERVAL_MS = 15_000;

type ViewMode = "month" | "week";

type ApiError = {
  erro?: string;
  message?: string;
  title?: string;
};

type ActionFeedback = {
  kind: "success" | "error";
  text: string;
};

function getApiError(error: unknown, fallback: string) {
  if (!axios.isAxiosError<ApiError>(error)) return fallback;
  const data = error.response?.data;
  return data?.erro || data?.message || data?.title || fallback;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatSelectedDate(date: Date, locale: string) {
  const formatted = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function isToday(date: Date) {
  return (
    formatAgendaDateParam(date) ===
    formatAgendaDateParam(new Date())
  );
}

export default function Agenda() {
  const { theme } = useTheme();
  const { t, lang } = useLanguage();
  const { usuario } = useUser();
  const { showNotification } = useNotification();

  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");

  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [profissionalId, setProfissionalId] = useState(0);

  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  const [realtimeStatus, setRealtimeStatus] =
    useState<AgendaRealtimeStatus>("connecting");

  const requestSequence = useRef(0);

  const selectedDateKey =
    formatAgendaDateParam(selectedDate);

  const isEmpresa =
    usuario?.Papel === "EMPRESA";

  const podeGerenciar =
    usuario?.Papel === "EMPRESA" || usuario?.Papel === "AUTONOMO";

  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [closingDay, setClosingDay] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);

  const selectedDateKeyRef =
    useRef(selectedDateKey);

  const refreshAgendaRef =
    useRef<(silent?: boolean) => Promise<void>>(
      async () => undefined,
    );

  const loadAgenda = useCallback(
    async (
      silent = false,
      signal?: AbortSignal,
    ) => {
      if (!usuario?.Id) {
        setAgendamentos([]);
        return;
      }

      const currentRequest =
        ++requestSequence.current;

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const filtroProfissional =
          isEmpresa && profissionalId > 0
            ? profissionalId
            : undefined;

        const data = await listarAgendaPorData(
          usuario.Id,
          selectedDateKey,
          filtroProfissional,
          signal,
        );

        if (
          currentRequest !== requestSequence.current
        ) {
          return;
        }

        setAgendamentos(data);
        setError("");
        setLastUpdated(new Date());
      } catch (requestError) {
        if (
          axios.isCancel(requestError) ||
          currentRequest !== requestSequence.current
        ) {
          return;
        }

        const message = t("agenda.loadFailed");
        setError(message);
        if (!silent) {
          showNotification({ type: "error", title: t("agenda.unavailable"), message });
        }
      } finally {
        if (
          currentRequest === requestSequence.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      isEmpresa,
      profissionalId,
      selectedDateKey,
      showNotification,
      usuario?.Id,
    ],
  );

  selectedDateKeyRef.current =
    selectedDateKey;

  refreshAgendaRef.current =
    async (silent = true) =>
      loadAgenda(silent);

  useEffect(() => {
    const controller =
      new AbortController();

    void loadAgenda(
      false,
      controller.signal,
    );

    return () =>
      controller.abort();
  }, [loadAgenda]);

  useEffect(() => {
    if (!isEmpresa || !usuario?.Id) {
      setProfissionais([]);
      setProfissionalId(0);
      return;
    }

    let active = true;

    listarProfissionaisEmpresa(usuario.Id)
      .then((items) => {
        if (active) {
          setProfissionais(items);
        }
      })
      .catch(() => {
        if (active) {
          setProfissionais([]);
          setProfissionalId(0);
          showNotification({
            type: "error",
            title: "Filtro indisponível",
            message: t("agenda.professionalsFailed"),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [isEmpresa, showNotification, usuario?.Id]);

  useEffect(() => {
    if (!usuario?.Id) {
      return;
    }

    const realtimeClient =
      createAgendaRealtimeClient({
        onAgendaUpdated: (event) => {
          const eventDate =
            event.Data || event.data;

          const eventBelongsToView =
            eventDate === selectedDateKeyRef.current;

          if (
            !eventDate ||
            eventBelongsToView
          ) {
            void refreshAgendaRef.current(
              true,
            );
          }
        },

        onStatusChange:
          setRealtimeStatus,
      });

    realtimeClient.start();

    return () => {
      void realtimeClient.stop();
    };
  }, [usuario?.Id]);

  useEffect(() => {
    const refreshVisibleAgenda = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void refreshAgendaRef.current(
          true,
        );
      }
    };

    const interval =
      window.setInterval(
        refreshVisibleAgenda,
        REFRESH_INTERVAL_MS,
      );

    window.addEventListener(
      "focus",
      refreshVisibleAgenda,
    );

    document.addEventListener(
      "visibilitychange",
      refreshVisibleAgenda,
    );

    return () => {
      window.clearInterval(interval);

      window.removeEventListener(
        "focus",
        refreshVisibleAgenda,
      );

      document.removeEventListener(
        "visibilitychange",
        refreshVisibleAgenda,
      );
    };
  }, [usuario?.Id]);

  const agendaItems =
    useMemo<AgendaCardItem[]>(() => {
      return [...agendamentos]
        .sort(
          (a, b) =>
            new Date(
              a.DataAgendamento,
            ).getTime() -
            new Date(
              b.DataAgendamento,
            ).getTime(),
        )
        .map((agendamento) => {
          const dataAgendamento =
            new Date(
              agendamento.DataAgendamento,
            );

          return {
            Id: agendamento.Id,

            cliente:
              formatPersonName(agendamento.ClienteNome) ||
              `Cliente #${agendamento.ClienteId}`,

            servico:
              agendamento.ServicoNome ||
              `Serviço #${agendamento.ServicoId}`,

            profissional:
              formatPersonName(agendamento.ProfissionalNome) ||
              `Profissional #${
                agendamento.ProfissionalId ??
                "-"
              }`,

            horario:
              dataAgendamento.toLocaleTimeString(
                "pt-BR",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                },
              ),

            status:
              agendamento.Status ||
              "AGENDADO",

            valor:
              formatCurrency(
                agendamento.ValorServico ||
                  agendamento.Valor ||
                  0,
              ),
          };
        });
    }, [agendamentos]);

  const selectedPeriodLabel = formatSelectedDate(selectedDate, lang === "pt" ? "pt-BR" : "en-US");

  const lastUpdatedLabel =
    lastUpdated
      ? `${t("agenda.updatedAt")} ${lastUpdated.toLocaleTimeString(
          lang === "pt" ? "pt-BR" : "en-US",
          {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          },
        )}`
      : t("agenda.awaitingUpdate");

  async function handleStatusChange(
    agendamentoId: number,
    status: "CANCELADO" | "CONCLUIDO",
  ) {
    setUpdatingId(agendamentoId);
    setActionFeedback(null);

    try {
      const updated = await atualizarStatusAgendamento(agendamentoId, status);
      setAgendamentos((items) => items.map((item) => (
        item.Id === agendamentoId ? { ...item, ...updated } : item
      )));
      setActionFeedback({
        kind: "success",
        text: status === "CANCELADO"
          ? t("agenda.canceled")
          : t("agenda.completed"),
      });
      showNotification({
        type: "success",
        title: status === "CANCELADO" ? t("agenda.canceledTitle") : t("agenda.completedTitle"),
        message: "O status foi atualizado na agenda.",
      });
    } catch (actionError) {
      const message = getApiError(actionError, t("agenda.updateFailed"));
      setActionFeedback({
        kind: "error",
        text: message,
      });
      showNotification({ type: "error", title: "Status não atualizado", message });
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCloseCurrentDay() {
    setClosingDay(true);
    setActionFeedback(null);

    try {
      const quantidade = await concluirAgendamentosDoDiaAtual();
      const today = new Date();
      const alreadyShowingToday = isToday(selectedDate);

      setSelectedDate(today);
      setActionFeedback({
        kind: "success",
        text: quantidade === 0
          ? t("agenda.nonePending")
          : `${quantidade} ${quantidade === 1 ? "agendamento concluído" : "agendamentos concluídos"}.`,
      });
      showNotification({
        type: quantidade === 0 ? "warning" : "success",
        title: quantidade === 0 ? t("agenda.dayCurrent") : t("agenda.completedAll"),
        message: quantidade === 0
          ? t("agenda.nonePending")
          : `${quantidade} ${quantidade === 1 ? "agendamento foi concluído" : "agendamentos foram concluídos"}.`,
      });

      if (alreadyShowingToday) {
        await loadAgenda(true);
      }
    } catch (actionError) {
      const message = getApiError(actionError, t("agenda.closeFailed"));
      setActionFeedback({
        kind: "error",
        text: message,
      });
      showNotification({ type: "error", title: t("agenda.closeErrorTitle"), message });
    } finally {
      setClosingDay(false);
    }
  }

  return (
    <main
      className={styles.container}
      style={{
        backgroundColor:
          theme.colors.background,
        color: theme.colors.text,
      }}
    >
      <aside
        className={styles.sidebar}
        aria-label={t("dashboard.period")}
      >
        <div
          className={
            styles.viewControls
          }
        >
          <div
            className={
              styles.segmented
            }
            aria-label={t("dashboard.period")}
          >
            <button
              type="button"
              className={
                viewMode === "month"
                  ? styles.activeSegment
                  : ""
              }
              onClick={() =>
                setViewMode("month")
              }
              aria-pressed={
                viewMode === "month"
              }
            >
              {t("agenda.monthly")}
            </button>

            <button
              type="button"
              className={
                viewMode === "week"
                  ? styles.activeSegment
                  : ""
              }
              onClick={() =>
                setViewMode("week")
              }
              aria-pressed={
                viewMode === "week"
              }
            >
              {t("agenda.weekly")}
            </button>
          </div>

          {isEmpresa && (
            <label
              className={
                styles.professionalFilter
              }
            >
              {t("common.professional")}

              <select
                value={profissionalId}
                onChange={(event) =>
                  setProfissionalId(
                    Number(
                      event.target.value,
                    ),
                  )
                }
              >
                <option value={0}>
                  {t("agenda.allProfessionals")}
                </option>

                {profissionais.map(
                  (profissional) => (
                    <option
                      key={
                        profissional.Id
                      }
                      value={
                        profissional.Id
                      }
                    >
                      {
                        profissional.Nome
                      }
                    </option>
                  ),
                )}
              </select>
            </label>
          )}
        </div>

        {viewMode === "month" ? (
          <Calendar
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        ) : (
          <WeekCalendar
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        )}

        <button
          type="button"
          className={
            styles.todayButton
          }
          onClick={() =>
            setSelectedDate(
              new Date(),
            )
          }
          disabled={isToday(
            selectedDate,
          )}
        >
          <FaCalendarDay
            aria-hidden="true"
          />

          {t("agenda.today")}
        </button>

        {["AUTONOMO", "EMPRESA", "PROFISSIONAL"].includes(usuario?.Papel || "") && (
          <button type="button" className={styles.newBookingButton} onClick={() => setBookingOpen(true)}>
            <FaPlus aria-hidden="true" />{t("booking.new")}
          </button>
        )}
        {podeGerenciar && (
          <button
            type="button"
            className={styles.closeAllButton}
            onClick={() => void handleCloseCurrentDay()}
            disabled={closingDay}
          >
            <FaCalendarCheck aria-hidden="true" />
            {closingDay ? t("agenda.closing") : t("agenda.closeAll")}
          </button>
        )}
      </aside>

      <section
        className={styles.content}
        aria-labelledby="agenda-title"
      >
        <header
          className={
            styles.pageHeader
          }
        >
          <div
            className={
              styles.titleGroup
            }
          >
            <h1 id="agenda-title">
              {selectedPeriodLabel}
            </h1>

            <div
              className={
                styles.updateInfo
              }
              role="status"
              aria-live="polite"
            >
              <span
                className={`${styles.liveDot} ${styles[realtimeStatus]}`}
              />

              <span>
                {
                  realtimeStatus === "connected" ? t("agenda.online") : realtimeStatus === "connecting" ? t("agenda.connecting") : realtimeStatus === "reconnecting" ? t("agenda.reconnecting") : t("agenda.offline")
                }
              </span>

              <span
                className={
                  styles.separator
                }
                aria-hidden="true"
              />

              <span>
                {lastUpdatedLabel}
              </span>
            </div>
          </div>

          <div
            className={
              styles.headerActions
            }
          >
            <span
              className={styles.count}
            >
              {
                agendaItems.length
              }{" "}
              {agendaItems.length ===
              1
                ? t("dashboard.oneAppointment")
                : t("dashboard.manyAppointments")}
            </span>

            <button
              type="button"
              className={
                styles.refreshButton
              }
              onClick={() =>
                void loadAgenda(true)
              }
              disabled={
                refreshing || loading
              }
              title={t("agenda.refresh")}
              aria-label={t("agenda.refresh")}
            >
              <FaRotate
                className={
                  refreshing
                    ? styles.rotating
                    : undefined
                }
                aria-hidden="true"
              />
            </button>
          </div>
        </header>

        {actionFeedback && (
          <div
            className={`${styles.actionFeedback} ${styles[actionFeedback.kind]}`}
            role={actionFeedback.kind === "error" ? "alert" : "status"}
          >
            {actionFeedback.text}
          </div>
        )}

        <Card
          agendamentos={agendaItems}
          loading={loading}
          error={error}
          selectedDateLabel={selectedPeriodLabel}
          updatingId={updatingId}
          onStatusChange={podeGerenciar ? handleStatusChange : undefined}
        />
      </section>
      {bookingOpen && <AgendaBooking date={selectedDate} professionalId={profissionalId}
        onClose={() => setBookingOpen(false)}
        onCreated={day => {
          setBookingOpen(false);
          setSelectedDate(new Date(day + "T12:00:00"));
          if (day === selectedDateKey) void loadAgenda(true);
          showNotification({ type: "success", title: t("booking.created"), message: t("booking.createdMessage") });
        }} />}
    </main>
  );
}
