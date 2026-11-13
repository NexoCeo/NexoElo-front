import { useSearchParams } from "react-router-dom";
import AgendaBooking from "@/components/agenda-booking";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaPlus, FaCalendarCheck, FaCalendarDay, FaFilter, FaClock, FaCircleCheck, FaCircleXmark, FaUsers, FaChevronDown, FaCheck } from "react-icons/fa6";
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
import { createAgendaRealtimeClient } from "@/services/agenda-realtime-service";
import type { Agendamento } from "@/types/agendamento";
import type { Profissional } from "@/types/profissional";
import styles from "./style.module.css";
import { getTimelineBounds, layoutTimeline } from "./timeline-layout";
import { formatPersonName } from "@/context/UserContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePageRevalidation } from "@/hooks/usePageRevalidation";

const REFRESH_INTERVAL_MS = 15_000;

type ViewMode = "month" | "week";

type ApiError = {
  erro?: string;
  message?: string;
  title?: string;
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [professionalOptionsOpen, setProfessionalOptionsOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);
  const professionalOptionsRef = useRef<HTMLDivElement>(null);
  const professionalTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!filtersOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!filtersRef.current?.contains(event.target as Node)) {
        setFiltersOpen(false);
        setProfessionalOptionsOpen(false);
      } else if (!professionalOptionsRef.current?.contains(event.target as Node)) {
        setProfessionalOptionsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (professionalOptionsOpen) {
        setProfessionalOptionsOpen(false);
        professionalTriggerRef.current?.focus();
      } else {
        setFiltersOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [filtersOpen, professionalOptionsOpen]);
  useEffect(() => {
    if (!professionalOptionsOpen) return;
    professionalOptionsRef.current
      ?.querySelector<HTMLButtonElement>('[role="option"][aria-selected="true"]')
      ?.focus();
  }, [professionalOptionsOpen]);
  const [searchParams] = useSearchParams();
  const requestedDate = searchParams.get("data");
  const requestedAppointmentId = Number(searchParams.get("agendamento") || "0");
  const [selectedDate, setSelectedDate] = useState(() => {
    if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      const date = new Date(requestedDate + "T12:00:00");
      if (!Number.isNaN(date.getTime()) && date.getFullYear() === Number(requestedDate.slice(0, 4)) &&
          date.getMonth() + 1 === Number(requestedDate.slice(5, 7)) &&
          date.getDate() === Number(requestedDate.slice(8, 10))) return date;
    }
    return new Date();
  });
  useEffect(() => {
    if (!requestedDate || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return;
    const date = new Date(requestedDate + "T12:00:00");
    if (!Number.isNaN(date.getTime())) setSelectedDate(date);
  }, [requestedDate]);
  const [viewMode, setViewMode] = useState<ViewMode>("week");

  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [profissionalId, setProfissionalId] = useState(0);

  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  const requestSequence = useRef(0);

  const selectedDateKey =
    formatAgendaDateParam(selectedDate);

  const isEmpresa =
    usuario?.Papel === "EMPRESA";

  const podeGerenciar =
    usuario?.Papel === "EMPRESA" || usuario?.Papel === "AUTONOMO";

  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [closingDay, setClosingDay] = useState(false);

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

      if (!silent) {
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

  usePageRevalidation(() => loadAgenda(true), { enabled: Boolean(usuario?.Id) && !bookingOpen && !closingDay, pollIntervalMs: 0 });

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

        onStatusChange: () => undefined,
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

    return () => {
      window.clearInterval(interval);

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

  const statusTotals = useMemo(() => ({
    completed: agendaItems.filter(item => ["CONCLUIDO", "CONCLUÍDO"].includes(item.status.trim().toUpperCase())).length,
    cancelled: agendaItems.filter(item => item.status.trim().toUpperCase() === "CANCELADO").length,
    scheduled: agendaItems.filter(item => !["CONCLUIDO", "CONCLUÍDO", "CANCELADO"].includes(item.status.trim().toUpperCase())).length,
  }), [agendaItems]);
  // A duração real do serviço determina a altura do card e os cruzamentos.
  // Agendamentos simultâneos ficam em raias paralelas, sem mudar o horário.
  const timelineSource = useMemo(() => {
    const durations = new Map(agendamentos.map(item => [item.Id, item.DuracaoMinutos]));
    return agendaItems.map(item => ({
      ...item,
      duracaoMinutos: durations.get(item.Id),
      cancelled: item.status.trim().toUpperCase() === "CANCELADO",
      completed: ["CONCLUIDO", "CONCLUÍDO"].includes(item.status.trim().toUpperCase()),
    }));
  }, [agendaItems, agendamentos]);

  const timelineBounds = useMemo(() => getTimelineBounds(timelineSource), [timelineSource]);
  const timelineStart = timelineBounds.startHour;
  const timelineEnd = timelineBounds.endHour;
  const timelineItems = useMemo(() =>
    layoutTimeline(timelineSource, timelineStart, timelineEnd),
    [timelineSource, timelineStart, timelineEnd],
  );

  async function handleStatusChange(
    agendamentoId: number,
    status: "CANCELADO" | "CONCLUIDO",
  ) {
    setUpdatingId(agendamentoId);

    try {
      const updated = await atualizarStatusAgendamento(agendamentoId, status);
      setAgendamentos((items) => items.map((item) => (
        item.Id === agendamentoId ? { ...item, ...updated } : item
      )));
      showNotification({
        type: "success",
        title: status === "CANCELADO" ? t("agenda.canceledTitle") : t("agenda.completedTitle"),
        message: "O status foi atualizado na agenda.",
      });
    } catch (actionError) {
      const message = getApiError(actionError, t("agenda.updateFailed"));
      showNotification({ type: "error", title: "Status não atualizado", message });
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCloseCurrentDay() {
    setClosingDay(true);

    try {
      const quantidade = await concluirAgendamentosDoDiaAtual();
      const today = new Date();
      const alreadyShowingToday = isToday(selectedDate);

      setSelectedDate(today);
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
      showNotification({ type: "error", title: t("agenda.closeErrorTitle"), message });
    } finally {
      setClosingDay(false);
    }
  }

  return (
    <main className={styles.container} style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}>
      <header className={styles.topHeader}>
        <div className={styles.headingTitle}>
          <span className={styles.headingIcon}><FaCalendarDay aria-hidden="true" /></span>
          <div><h1 id="agenda-title">Agenda</h1><p>Visualize e gerencie seus agendamentos.</p></div>
        </div>
        <div className={styles.topActions}>
          <div className={styles.filterAnchor} ref={filtersRef}>
          <button type="button" className={styles.filterToggle} onClick={() => {
              setFiltersOpen(open => !open);
              setProfessionalOptionsOpen(false);
            }}
            aria-label="Filtros da agenda" title="Filtros da agenda"
            aria-expanded={filtersOpen} aria-haspopup="dialog" aria-controls="agenda-filters">
            <FaFilter aria-hidden="true" />
          </button>
      {filtersOpen && <div id="agenda-filters" className={styles.filtersPanel} role="dialog" aria-label="Filtros da agenda">
        <div
          className={styles.viewControls}
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
          </div>

          {isEmpresa && (
            <div className={styles.professionalFilter} ref={professionalOptionsRef}>
              <button
                type="button"
                ref={professionalTriggerRef}
                className={`${styles.professionalSelect} ${professionalOptionsOpen ? styles.professionalSelectOpen : ""}`}
                aria-haspopup="listbox"
                aria-expanded={professionalOptionsOpen}
                aria-controls="agenda-professional-options"
                onClick={() => setProfessionalOptionsOpen(open => !open)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    setProfessionalOptionsOpen(true);
                  }
                }}
              >
                <span className={styles.professionalSelectLabel}>{t("common.professional")}</span>
                <span className={styles.professionalSelectValue}>
                  <FaUsers aria-hidden="true" />
                  <span>
                    {profissionais.find(profissional => profissional.Id === profissionalId)?.Nome
                      ?? t("agenda.allProfessionals")}
                  </span>
                  <FaChevronDown className={professionalOptionsOpen ? styles.professionalChevronOpen : ""} aria-hidden="true" />
                </span>
              </button>

              {professionalOptionsOpen && (
                <div
                  className={styles.professionalOptions}
                  id="agenda-professional-options"
                  role="listbox"
                  aria-label={t("common.professional")}
                  onKeyDown={event => {
                    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
                    event.preventDefault();
                    const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
                    const index = options.indexOf(document.activeElement as HTMLButtonElement);
                    const next = event.key === "Home" ? 0
                      : event.key === "End" ? options.length - 1
                      : event.key === "ArrowDown" ? (index + 1) % options.length
                      : (index - 1 + options.length) % options.length;
                    options[next]?.focus();
                  }}
                >
                  {[{ Id: 0, Nome: t("agenda.allProfessionals") }, ...profissionais].map(profissional => (
                    <button
                      key={profissional.Id}
                      type="button"
                      role="option"
                      aria-selected={profissionalId === profissional.Id}
                      className={`${styles.professionalOption} ${profissionalId === profissional.Id ? styles.professionalOptionSelected : ""}`}
                      onClick={() => {
                        setProfissionalId(profissional.Id);
                        setProfessionalOptionsOpen(false);
                        professionalTriggerRef.current?.focus();
                      }}
                    >
                      <span>{profissional.Nome}</span>
                      {profissionalId === profissional.Id && <FaCheck aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>}
          </div>
          {["AUTONOMO", "EMPRESA", "PROFISSIONAL"].includes(usuario?.Papel || "") && (
            <button type="button" className={styles.newBookingButton} onClick={() => setBookingOpen(true)}>
              <FaPlus aria-hidden="true" />{t("booking.new")}
            </button>
          )}
        </div>
      </header>
      <section className={styles.metrics} aria-label="Resumo dos agendamentos da data selecionada">
        <div className={styles.metric}><span className={styles.metricIcon}><FaCalendarDay /></span><div><strong>{agendaItems.length}</strong><span>Agendamentos no dia</span></div></div>
        <div className={styles.metric}><span className={styles.metricIcon}><FaCircleCheck /></span><div><strong>{statusTotals.completed}</strong><span>Concluídos</span></div></div>
        <div className={styles.metric}><span className={styles.metricIcon}><FaClock /></span><div><strong>{statusTotals.scheduled}</strong><span>Agendados</span></div></div>
        <div className={styles.metric}><span className={styles.metricIcon}><FaCircleXmark /></span><div><strong>{statusTotals.cancelled}</strong><span>Cancelados</span></div></div>
      </section>
      <div className={styles.dayGrid}>
      <aside
        className={styles.sidebar}
        aria-label={t("dashboard.period")}
      >

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



      </aside>
      <section className={styles.timelinePanel} aria-label="Horários do dia">
        <div className={styles.panelHeader}>
          <h2>{selectedPeriodLabel}</h2>
          <span>{agendaItems.length} {agendaItems.length === 1 ? "agendamento" : "agendamentos"}</span>
        </div>
        <div className={styles.timelineViewport}>
        <div className={styles.timelineCanvas} style={{
          height: `${(timelineEnd - timelineStart) * 60}px`,
          minHeight: `${(timelineEnd - timelineStart) * 60}px`,
        }}>
          {Array.from({length:timelineEnd-timelineStart+1}, (_, index) => (
            <div key={index} className={styles.hourRow} style={{top:`${index/(timelineEnd-timelineStart)*100}%`}}>
              <span>{String(timelineStart+index).padStart(2,"0")}:00</span>
            </div>
          ))}
          <div className={styles.timelineEvents}>
            {timelineItems.map(item => (
              <div key={item.Id}
                className={`${styles.timelineEvent} ${item.laneCount > 1 ? styles.timelineEventCompact : ""} ${item.completed ? styles.eventCompleted : ""} ${item.cancelled ? styles.eventCancelled : ""}`}
                style={{
                  top: `${item.top}%`,
                  height: `${item.height}%`,
                  left: `calc(${(item.lane / item.laneCount) * 100}% + 3px)`,
                  width: `calc(${100 / item.laneCount}% - 6px)`,
                  right: "auto",
                }}
                title={`${item.servico} — ${item.cliente} — ${item.horario}${item.duracaoMinutos ? ` (${item.duracaoMinutos} min)` : ""}`}
                aria-label={`${item.servico}, ${item.cliente}, ${item.horario}`}
                data-appointment-id={item.Id}
                data-event-lane={item.lane}
                data-event-lanes={item.laneCount}>
                <strong>{item.servico}</strong><small>{item.horario}</small>
              </div>
            ))}
          </div>
        </div>
        </div>
      </section>
      <section className={styles.content} aria-label="Agendamentos do dia">
        <header className={styles.listPanelHeader} title={lastUpdatedLabel}>
          <h2>Agendamentos do dia</h2>
          <span className={styles.appointmentCount} aria-label={`${agendaItems.length} agendamentos`} aria-live="polite">{agendaItems.length}</span>
        </header>
        <Card
          compactAgenda
          agendamentos={agendaItems}
          focusAppointmentId={Number.isSafeInteger(requestedAppointmentId) && requestedAppointmentId > 0 ? requestedAppointmentId : undefined}
          loading={loading}
          error={error}
          selectedDateLabel={selectedPeriodLabel}
          updatingId={updatingId}
          onStatusChange={podeGerenciar ? handleStatusChange : undefined}
        />
        <div className={styles.closeDayAction}>        {podeGerenciar && (
          <button
            type="button"
            className={styles.closeAllButton}
            onClick={() => void handleCloseCurrentDay()}
            disabled={closingDay}
          >
            <FaCalendarCheck aria-hidden="true" />
            {closingDay ? t("agenda.closing") : t("agenda.closeAll")}
          </button>
        )}</div>
      </section>
      </div>
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
