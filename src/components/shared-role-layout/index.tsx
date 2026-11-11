import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { FaHome, FaCalendarAlt, FaTools, FaUsers, FaThLarge, FaChartBar, FaClock, FaChartLine, FaWhatsapp, FaTimes } from "react-icons/fa";
import { useUser } from "@/context/UserContext";
import { useLanguage } from "@/context/LanguageContext";
import { getRoleBasePath } from "@/routes/role-paths";
import { consultarAssinatura } from "@/services/assinatura-service";
import Header from "@/components/header";
import SupportWidget from "@/components/support-widget";
import Sidebar from "@/components/sidebar";
import styles from "./style.module.css";

interface SharedRoleLayoutProps {
  children: ReactNode;
}

function MobileNavigation() {
  const { usuario } = useUser();
  const { t } = useLanguage();
  const location = useLocation();
  const base = getRoleBasePath(usuario?.Papel);
  const manager = usuario?.Papel === "EMPRESA" || usuario?.Papel === "AUTONOMO";
  const [moreOpen, setMoreOpen] = useState(false);
  const [access, setAccess] = useState({ reports: false, analytics: false, whatsapp: false });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!manager) return;
    let active = true;
    consultarAssinatura().then(assinatura => {
      if (!active) return;
      setAccess({
        reports: assinatura.AcessoAtivo && (assinatura.Plano === "GRATIS" || assinatura.RelatoriosLiberados),
        analytics: assinatura.AcessoAtivo && (assinatura.Plano === "GRATIS" || assinatura.Plano === "AVANCADO"),
        whatsapp: assinatura.AcessoAtivo && assinatura.Plano === "AVANCADO",
      });
    }).catch(() => { if (active) setAccess({ reports: false, analytics: false, whatsapp: false }); });
    return () => { active = false; };
  }, [manager, usuario?.Id]);
  useEffect(() => {
    if (!moreOpen) return;
    const onOutside = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMoreOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMoreOpen(false); };
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [moreOpen]);

  const primary = [
    { to: `${base}/dashboard`, label: "Início", icon: <FaHome aria-hidden="true" /> },
    { to: `${base}/agenda`, label: t("nav.calendar"), icon: <FaCalendarAlt aria-hidden="true" /> },
    ...(manager ? [{ to: `${base}/servicos`, label: t("nav.services"), icon: <FaTools aria-hidden="true" /> }] : []),
    ...(usuario?.Papel === "EMPRESA" ? [{ to: "/empresa/profissionais", label: t("nav.professionals"), icon: <FaUsers aria-hidden="true" /> }] : []),
  ];
  const secondary = [
    ...(manager ? [{ to: `${base}/funcionamento`, label: t("nav.hours"), icon: <FaClock aria-hidden="true" /> }] : []),
    ...(manager && access.reports ? [{ to: `${base}/relatorios`, label: t("nav.reports"), icon: <FaChartBar aria-hidden="true" /> }] : []),
    ...(manager && access.analytics ? [{ to: `${base}/analise-dados/metricas`, label: t("nav.metrics"), icon: <FaChartLine aria-hidden="true" /> }] : []),
    ...(manager && access.whatsapp ? [{ to: `${base}/analise-dados/whatsapp-business`, label: "WhatsApp Business", icon: <FaWhatsapp aria-hidden="true" /> }] : []),
  ];
  const moreActive = secondary.some(item => location.pathname === item.to);
  return (
    <div className={styles.mobileNavHost} ref={menuRef}>
      {moreOpen && <div className={styles.mobileMore} aria-label="Mais páginas">
        <div className={styles.mobileMoreTitle}><strong>Mais opções</strong><button type="button" onClick={() => setMoreOpen(false)} aria-label="Fechar mais opções"><FaTimes /></button></div>
        {secondary.map(item => <NavLink key={item.to} to={item.to} className={({isActive}) => `${styles.mobileMoreLink} ${isActive ? styles.mobileMoreActive : ""}`} onClick={() => setMoreOpen(false)}>{item.icon}<span>{item.label}</span></NavLink>)}
      </div>}
      <div className={styles.mobileNav} aria-label="Navegação móvel">
        {primary.map(item => <NavLink key={item.to} to={item.to} end className={({isActive}) => `${styles.mobileNavItem} ${isActive ? styles.mobileNavActive : ""}`}>{item.icon}<span>{item.label}</span></NavLink>)}
        <button type="button" className={`${styles.mobileNavItem} ${moreOpen || moreActive ? styles.mobileNavActive : ""}`} aria-expanded={moreOpen} aria-label="Mais opções" onClick={() => setMoreOpen(value => !value)}><FaThLarge aria-hidden="true"/><span>Mais</span></button>
      </div>
    </div>
  );
}

export default function SharedRoleLayout({ children }: SharedRoleLayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 760px)").matches
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (isMobile) setIsMenuOpen(false);
  }, [isMobile]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <div className={styles.shell} data-sidebar-open={isMenuOpen}>
      <Header isMenuOpen={isMenuOpen} toggleMenu={() => setIsMenuOpen((open) => !open)} />
      <Sidebar isMenuOpen={isMenuOpen} closeMenu={() => setIsMenuOpen(false)} />

      <div
        className={`${styles.content} ${isMenuOpen ? styles.contentShifted : ""}`}
        data-testid="role-page-content"
      >
        {children}
      </div>
      {isMobile && <MobileNavigation />}
      <SupportWidget />
    </div>
  );
}
