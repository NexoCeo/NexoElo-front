import { useLanguage } from "@/context/LanguageContext";
import { useEffect, useRef, useState } from "react";
import { FaBell, FaCheck, FaInbox, FaTimes, FaUserClock } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { formatPersonName, useUser } from "@/context/UserContext";
import { createAgendaRealtimeClient } from "@/services/agenda-realtime-service";
import { listarSolicitacoesVinculo, type SolicitacaoVinculo } from "@/services/vinculo-service";
import { listarNotificacoesAgendamento, marcarNotificacaoAgendamentoLida, marcarTodasNotificacoesAgendamentoLidas, type NotificacaoAgendamento } from "@/services/notificacoes-agendamento-service";
import { FaCalendarCheck } from "react-icons/fa";
import styles from "./style.module.css";

type Tab = "all" | "unread";
const STORAGE_PREFIX = "nexoelo:read-link-requests:";
function getRead(empresaId: number): string[] {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_PREFIX + empresaId) || "[]");
    return Array.isArray(data) ? data.filter((id): id is string => typeof id === "string") : [];
  } catch { return []; }
}
function notificationId(item: SolicitacaoVinculo) { return "vinculo:" + item.VinculoId; }

function formatBookingNotification(message: string): string {
  return message.replace(/^(.+?)( agendou )/u, (_, customer: string, verb: string) =>
    formatPersonName(customer) + verb).replace(/( com )(.+?)( para \d{2}\/\d{2}\/\d{4})/u,
    (_, prefix: string, professional: string, suffix: string) =>
      prefix + formatPersonName(professional) + suffix);
}

export default function NotificationBell() {
  const { t } = useLanguage();
  const { usuario } = useUser();
  const navigate = useNavigate();
  const empresaId = usuario?.Papel?.toUpperCase() === "EMPRESA" ? usuario.Id : 0;
  const notificationsUserId = ["EMPRESA","AUTONOMO","PROFISSIONAL"].includes(usuario?.Papel?.toUpperCase() || "") ? usuario?.Id || 0 : 0;
  const [items, setItems] = useState<SolicitacaoVinculo[]>([]);
  const [appointments, setAppointments] = useState<NotificacaoAgendamento[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [error, setError] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems([]);
    setReadIds(empresaId ? getRead(empresaId) : []);
    setOpen(false);
    if (!empresaId) return;
    let alive = true;
    const refresh = async () => {
      try {
        const pending = await listarSolicitacoesVinculo(empresaId);
        if (alive) { setItems(pending.filter(item => item.VinculoId > 0)); setError(false); }
      } catch { if (alive) setError(true); }
    };
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 30000);
    const handleFocus = () => void refresh();
    window.addEventListener("focus", handleFocus);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener("focus", handleFocus); };
  }, [empresaId]);

  useEffect(() => {
    setAppointments([]);
    if (!notificationsUserId) return;
    let alive = true;
    const refresh = async () => {
      try {
        const result = await listarNotificacoesAgendamento();
        if (alive) setAppointments(result);
      } catch { /* Other notification types remain available if this endpoint fails. */ }
    };
    void refresh();
    const realtime = createAgendaRealtimeClient({
      onAgendaUpdated: () => { if (alive) void refresh(); },
      onStatusChange: () => {},
    });
    realtime.start();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 30000);
    const focus = () => { void refresh(); };
    window.addEventListener("focus", focus);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
      void realtime.stop();
    };
  }, [notificationsUserId]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => { document.removeEventListener("mousedown", handleOutside); document.removeEventListener("keydown", handleEscape); };
  }, [open]);

  const unread = items.filter(item => !readIds.includes(notificationId(item)));
  const appointmentUnread = appointments.filter(item => !item.Lida);
  const unreadCount = unread.length + appointmentUnread.length;
  const visible = tab === "unread" ? unread : items;
  const visibleAppointments = tab === "unread" ? appointmentUnread : appointments;
  function persistRead(next: string[]) {
    setReadIds(next);
    if (empresaId) localStorage.setItem(STORAGE_PREFIX + empresaId, JSON.stringify(next));
  }
  function openRequest(item: SolicitacaoVinculo) {
    persistRead([...new Set([...readIds, notificationId(item)])]);
    setOpen(false);
    navigate("/empresa/profissionais?solicitacoes=1");
  }
  function openAppointment(item: NotificacaoAgendamento) {
    setOpen(false);
    setAppointments(current => current.map(n => n.Id === item.Id ? { ...n, Lida: true } : n));
    void marcarNotificacaoAgendamentoLida(item.Id).catch(() => {
      setAppointments(current => current.map(n => n.Id === item.Id ? { ...n, Lida: false } : n));
    });
    const date = item.DataAgendamento.slice(0, 10);
    const prefix = usuario?.Papel?.toUpperCase() === "EMPRESA" ? "/empresa" :
      usuario?.Papel?.toUpperCase() === "PROFISSIONAL" ? "/profissional" : "/autonomo";
    navigate(`${prefix}/agenda?data=${encodeURIComponent(date)}&agendamento=${item.AgendamentoId}`);
  }
  function markAllRead() {
    persistRead([...new Set([...readIds, ...unread.map(notificationId)])]);
    setAppointments(current => current.map(n => ({ ...n, Lida: true })));
    void marcarTodasNotificacoesAgendamentoLidas().catch(() => {});
  }
  return <div className={styles.wrapper} ref={panelRef}>
    <button type="button" className={styles.bellButton}
      onClick={() => setOpen(value => !value)}
      aria-label={unreadCount ? `${t("notification.title")}: ${unreadCount} ${t("notification.unreadCount")}` : t("notification.open")}
      aria-expanded={open} aria-haspopup="dialog">
      <span className={styles.bellIconWrap}>
        <FaBell aria-hidden="true" />
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </span>
    </button>
    {open && <section className={styles.panel} role="dialog" aria-label={t("notification.title")}>
      <div className={styles.heading}>
        <strong>{t("notification.title")} ({unreadCount})</strong>
        <button type="button" onClick={() => setOpen(false)} aria-label={t("notification.close")}><FaTimes /></button>
      </div>
      <div className={styles.tabs}>
        <button type="button" className={tab === "all" ? styles.active : ""} onClick={() => setTab("all")}>{t("notification.all")}</button>
        <button type="button" className={tab === "unread" ? styles.active : ""} onClick={() => setTab("unread")}>{t("notification.unread")}</button>
        <button type="button" className={styles.clear} disabled={!unreadCount}
          onClick={markAllRead}>{t("notification.markRead")}</button>
      </div>
      <div className={styles.content}>
        {error && <p className={styles.feedback} role="status">{t("notification.error")}</p>}
        {!visible.length && !visibleAppointments.length && <div className={styles.empty}>
          <FaInbox aria-hidden="true"/>
          <strong>{tab === "unread" ? t("notification.emptyUnread") : t("notification.emptyAll")}</strong>
          <span>{t("notification.empty")}</span>
        </div>}
        {visibleAppointments.map(item => <button type="button" className={styles.item}
          key={`agendamento:${item.Id}`} onClick={() => openAppointment(item)}>
          <span className={styles.itemIcon}><FaCalendarCheck /></span>
          <span className={styles.itemText}>
            <strong>{item.Titulo}</strong>
            <span>{formatBookingNotification(item.Mensagem)}</span>
            <small>{t("notification.view")}</small>
          </span>
          {item.Lida ? <FaCheck className={styles.read} aria-label={t("notification.read")} /> :
            <span className={styles.unreadDot} aria-label={t("notification.unreadOne")} />}
        </button>)}
        {visible.map(item => <button type="button" className={styles.item}
            key={item.VinculoId} onClick={() => openRequest(item)}>
          <span className={styles.itemIcon}><FaUserClock /></span>
          <span className={styles.itemText}>
            <strong>{t("notification.linkRequest")}</strong>
            <span>{item.Nome || t("notification.someone")} {t("notification.requestSuffix")}</span>
            <small>{t("notification.view")}</small>
          </span>
          {readIds.includes(notificationId(item)) ? <FaCheck className={styles.read} aria-label={t("notification.read")} /> : <span className={styles.unreadDot} aria-label={t("notification.unreadOne")} />}
        </button>)}
      </div>
    </section>}
  </div>;
}
