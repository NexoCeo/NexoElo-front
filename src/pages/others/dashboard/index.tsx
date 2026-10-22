import { formatPersonName } from "@/context/UserContext";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaArrowRight, FaCalendarDay } from "react-icons/fa6";
import { useTheme } from "@/context/ThemeContext";
import { useNotification } from "@/context/NotificationContext";
import { Card, type AgendaCardItem } from "@/components/cardClientes";
import {
  formatAgendaDateParam,
  listarAgendaPorData,
  listarAgendaPorPeriodo,
} from "@/services/agendamento-service";
import { getStoredUser } from "@/services/auth-token";
import { createAgendaRealtimeClient } from "@/services/agenda-realtime-service";
import { getRolePagePath } from "@/routes/role-paths";
import type { Agendamento } from "@/types/agendamento";
import styles from "./style.module.css";
import { useLanguage } from "@/context/LanguageContext";

type DashboardRange = "today" | "week";

function weekRange(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function toCardItem(appointment: Agendamento, includeDate: boolean): AgendaCardItem {
  const date = new Date(appointment.DataAgendamento);
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const prefix = includeDate
    ? `${new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit" }).format(date)} - `
    : "";

  return {
    Id: appointment.Id,
    cliente: formatPersonName(appointment.ClienteNome) || `Cliente #${appointment.ClienteId}`,
    servico: appointment.ServicoNome || `Servico #${appointment.ServicoId}`,
    profissional: formatPersonName(appointment.ProfissionalNome) || "Profissional",
    horario: `${prefix}${time}`,
    status: appointment.Status || "AGENDADO",
    valor: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
      appointment.ValorServico || appointment.Valor || 0,
    ),
  };
}

export default function Dashboard() {
  const { theme } = useTheme();
  const { t, lang } = useLanguage();
  const { showNotification } = useNotification();
  const usuario = getStoredUser<{ Id?: number; Papel?: string }>();
  const role = usuario?.Papel?.toUpperCase();
  const isProfessional = role === "PROFISSIONAL";
  const canOpenAgenda = role === "EMPRESA" || role === "AUTONOMO";
  const [range, setRange] = useState<DashboardRange>("today");
  const [appointments, setAppointments] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadAppointments = useCallback(async () => {
    if (!usuario?.Id) return;

    try {
      setLoading(true);
      setError("");
      const now = new Date();
      if (!isProfessional || range === "today") {
        setAppointments(await listarAgendaPorData(usuario.Id, formatAgendaDateParam(now)));
      } else {
        const period = weekRange(now);
        setAppointments(await listarAgendaPorPeriodo(
          usuario.Id,
          formatAgendaDateParam(period.start),
          formatAgendaDateParam(period.end),
        ));
      }
    } catch {
      const message = t("dashboard.loadError");
      setError(message);
      showNotification({ type: "error", title: t("dashboard.unavailable"), message });
    } finally {
      setLoading(false);
    }
  }, [isProfessional, range, showNotification, t, usuario?.Id]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    if (!usuario?.Id) return;

    const realtimeClient = createAgendaRealtimeClient({
      onAgendaUpdated: () => void loadAppointments(),
      onStatusChange: () => undefined,
    });
    realtimeClient.start();
    return () => {
      void realtimeClient.stop();
    };
  }, [isProfessional, loadAppointments, usuario?.Id]);

  const agendaItems = useMemo(
    () => [...appointments]
      .sort(
        (first, second) =>
          new Date(first.DataAgendamento).getTime() -
          new Date(second.DataAgendamento).getTime(),
      )
      .map((item) => toCardItem(item, isProfessional && range === "week")),
    [appointments, isProfessional, range],
  );

  const todayLabel = new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());
  const appointmentCountLabel = loading
    ? t("dashboard.update")
    : `${agendaItems.length} ${agendaItems.length === 1 ? t("dashboard.oneAppointment") : t("dashboard.manyAppointments")}`;

  return (
    <main className={styles.container} style={{ backgroundColor: theme.colors.background }}>
      <section className={styles.agendaSection} aria-labelledby="dashboard-agenda-title">
        <div className={styles.agendaHeader}>
          <div className={styles.agendaTitleGroup}>
            <h2 id="dashboard-agenda-title">
              <FaCalendarDay aria-hidden="true" />
              <span>{isProfessional && range === "week" ? t("dashboard.week") : t("dashboard.today")}</span>
            </h2>
            <p>
              {isProfessional && range === "week" ? t("dashboard.currentWeek") : todayLabel}
              <span aria-hidden="true" />
              {appointmentCountLabel}
            </p>
          </div>

          <div className={styles.agendaActions}>
            {isProfessional ? (
              <div className={styles.segmented} aria-label={t("dashboard.period")}>
                <button
                  type="button"
                  className={range === "today" ? styles.active : ""}
                  onClick={() => setRange("today")}
                  aria-pressed={range === "today"}
                >
                  {t("dashboard.todayFilter")}
                </button>
                <button
                  type="button"
                  className={range === "week" ? styles.active : ""}
                  onClick={() => setRange("week")}
                  aria-pressed={range === "week"}
                >
                  {t("dashboard.weekFilter")}
                </button>
              </div>
            ) : canOpenAgenda ? (
              <Link
                className={styles.agendaLink}
                to={getRolePagePath(role, "agenda")}
              >
                {t("dashboard.openCalendar")}
                <FaArrowRight aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </div>

        <Card
          agendamentos={agendaItems}
          loading={loading}
          error={error}
          selectedDateLabel={
            isProfessional && range === "week" ? t("dashboard.weekFilter") : t("dashboard.todayFilter")
          }
        />
      </section>
    </main>
  );
}
