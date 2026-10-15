import { useEffect, useRef, useState } from "react";
import { FaBell, FaCheck, FaInbox, FaTimes, FaUserClock } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { listarSolicitacoesVinculo, type SolicitacaoVinculo } from "@/services/vinculo-service";
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

export default function NotificationBell() {
  const { usuario } = useUser();
  const navigate = useNavigate();
  const empresaId = usuario?.Papel?.toUpperCase() === "EMPRESA" ? usuario.Id : 0;
  const [items, setItems] = useState<SolicitacaoVinculo[]>([]);
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
  const visible = tab === "unread" ? unread : items;
  function persistRead(next: string[]) {
    setReadIds(next);
    if (empresaId) localStorage.setItem(STORAGE_PREFIX + empresaId, JSON.stringify(next));
  }
  function openRequest(item: SolicitacaoVinculo) {
    persistRead([...new Set([...readIds, notificationId(item)])]);
    setOpen(false);
    navigate("/empresa/profissionais?solicitacoes=1");
  }
  return <div className={styles.wrapper} ref={panelRef}>
    <button type="button" className={styles.bellButton}
      onClick={() => setOpen(value => !value)}
      aria-label={unread.length ? `Notificações: ${unread.length} não lidas` : "Abrir notificações"}
      aria-expanded={open} aria-haspopup="dialog">
      <FaBell aria-hidden="true" />
      {unread.length > 0 && <span className={styles.badge}>{unread.length > 99 ? "99+" : unread.length}</span>}
    </button>
    {open && <section className={styles.panel} role="dialog" aria-label="Notificações">
      <div className={styles.heading}>
        <strong>Notificações ({unread.length})</strong>
        <button type="button" onClick={() => setOpen(false)} aria-label="Fechar notificações"><FaTimes /></button>
      </div>
      <div className={styles.tabs}>
        <button type="button" className={tab === "all" ? styles.active : ""} onClick={() => setTab("all")}>Todas</button>
        <button type="button" className={tab === "unread" ? styles.active : ""} onClick={() => setTab("unread")}>Não lidas</button>
        <button type="button" className={styles.clear} disabled={!unread.length}
          onClick={() => persistRead([...new Set([...readIds, ...unread.map(notificationId)])])}>Marcar todas como lidas</button>
      </div>
      <div className={styles.content}>
        {error && <p className={styles.feedback} role="status">Não foi possível atualizar as notificações.</p>}
        {!visible.length && <div className={styles.empty}>
          <FaInbox aria-hidden="true"/>
          <strong>Nenhuma notificação {tab === "unread" ? "não lida" : "por enquanto"}</strong>
          <span>Novas solicitações de vínculo aparecerão aqui.</span>
        </div>}
        {visible.map(item => <button type="button" className={styles.item}
            key={item.VinculoId} onClick={() => openRequest(item)}>
          <span className={styles.itemIcon}><FaUserClock /></span>
          <span className={styles.itemText}>
            <strong>Solicitação de vínculo</strong>
            <span>{item.Nome || "Um profissional"} quer se vincular à sua empresa.</span>
            <small>Ver solicitação</small>
          </span>
          {readIds.includes(notificationId(item)) ? <FaCheck className={styles.read} aria-label="Lida" /> : <span className={styles.unreadDot} aria-label="Não lida" />}
        </button>)}
      </div>
    </section>}
  </div>;
}
