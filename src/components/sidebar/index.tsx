import { useEffect, useRef, useState, type CSSProperties } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { FaCalendarAlt, FaChartBar, FaChartLine, FaClock, FaHome, FaTimes, FaTools, FaWhatsapp } from "react-icons/fa";
import { FaPerson } from "react-icons/fa6";
import styles from "./style.module.css";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { getRoleBasePath } from "@/routes/role-paths";
import { consultarAssinatura } from "@/services/assinatura-service";

interface SidebarProps {
  isMenuOpen: boolean;
  closeMenu: () => void;
}

export default function Sidebar({ isMenuOpen, closeMenu }: SidebarProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { usuario } = useUser();
  const navRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const [analyticsExpanded, setAnalyticsExpanded] = useState(false);
  const [relatoriosLiberados, setRelatoriosLiberados] = useState(false);
  const [analiseLiberada, setAnaliseLiberada] = useState(false);
  useEffect(() => {
    if (usuario?.Papel !== "EMPRESA" && usuario?.Papel !== "AUTONOMO") {
      setRelatoriosLiberados(false);
      setAnaliseLiberada(false);
      return;
    }
    setRelatoriosLiberados(false);
    setAnaliseLiberada(false);
    let active = true;
    consultarAssinatura().then(acesso => {
      if (active) {
        setRelatoriosLiberados(acesso.AcessoAtivo && (acesso.Plano === "GRATIS" || acesso.RelatoriosLiberados));
        setAnaliseLiberada(acesso.AcessoAtivo && (acesso.Plano === "GRATIS" || acesso.Plano === "AVANCADO"));
      }
    }).catch(() => { if (active) { setRelatoriosLiberados(false); setAnaliseLiberada(false); } });
    return () => { active = false; };
  }, [usuario?.Papel, usuario?.Id]);
  const basePath = getRoleBasePath(usuario?.Papel);
  const analyticsPath = `${basePath}/analise-dados`;
  useEffect(() => { if (location.pathname.startsWith(analyticsPath)) setAnalyticsExpanded(true); }, [location.pathname, analyticsPath]);
  const canManageSharedSettings = usuario?.Papel === "EMPRESA" || usuario?.Papel === "AUTONOMO";
  const sidebarStyle = {
    backgroundColor: theme.colors.background2,
    borderColor: theme.colors.bottom,
    "--sidebar-primary": theme.colors.primary,
    "--sidebar-text": theme.colors.text,
    "--sidebar-inactive": theme.colors.inactive,
  } as CSSProperties;

  const linkClassName = ({ isActive }: { isActive: boolean }) =>
    `${styles.navLink} ${isActive ? styles.active : ""}`;

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    }

    if (isMenuOpen) {
      document.addEventListener("pointerdown", handlePointerDown);
    }

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [closeMenu, isMenuOpen]);

  return (
    <nav
      ref={navRef}
      id="app-sidebar"
      className={`${styles.nav} ${isMenuOpen ? styles.open : ""}`}
      style={sidebarStyle}
      aria-label={t("nav.main")}
      aria-hidden={!isMenuOpen}
    >
      <button
        type="button"
        className={styles.closeMenuIcon}
        style={{ color: theme.colors.text }}
        onClick={closeMenu}
        aria-label={t("nav.close")}
      >
        <FaTimes aria-hidden="true" />
      </button>

      <ul className={styles.navList}>
        <li className={styles.navItem}>
          <NavLink to={`${basePath}/dashboard`} end className={linkClassName} onClick={closeMenu}>
            <FaHome className={styles.navIcon} aria-hidden="true" />
            <span>{t("nav.dashboard")}</span>
          </NavLink>
        </li>

        <li className={styles.navItem}>
          <NavLink to={`${basePath}/agenda`} end className={linkClassName} onClick={closeMenu}>
            <FaCalendarAlt className={styles.navIcon} aria-hidden="true" />
            <span>{t("nav.calendar")}</span>
          </NavLink>
        </li>

        {canManageSharedSettings && (
          <li className={styles.navItem}>
            <NavLink to={`${basePath}/servicos`} end className={linkClassName} onClick={closeMenu}>
              <FaTools className={styles.navIcon} aria-hidden="true" />
              <span>{t("nav.services")}</span>
            </NavLink>
          </li>
        )}

        {canManageSharedSettings && (
          <li className={styles.navItem}>
            <NavLink
              to={`${basePath}/funcionamento`}
              end
              className={linkClassName}
              onClick={closeMenu}
            >
              <FaClock className={styles.navIcon} aria-hidden="true" />
              <span>{t("nav.hours")}</span>
            </NavLink>
          </li>
        )}

        {canManageSharedSettings && relatoriosLiberados && (
          <li className={styles.navItem}>
            <NavLink to={`${basePath}/relatorios`} end className={linkClassName} onClick={closeMenu}>
              <FaChartBar className={styles.navIcon} aria-hidden="true" />
              <span>{t("nav.reports")}</span>
            </NavLink>
          </li>
        )}

        {canManageSharedSettings && analiseLiberada && (
          <li className={styles.navItem}>
            <div className={styles.analyticsGroup}>
              <div className={styles.analyticsMain}>
                <NavLink to={analyticsPath} end className={linkClassName} onClick={closeMenu}>
                  <FaChartLine className={styles.navIcon} aria-hidden="true" />
                  <span>{t("nav.analytics")}</span>
                </NavLink>
                <button type="button" className={styles.expandButton} onClick={() => setAnalyticsExpanded(v => !v)} aria-label="Expandir Análise de dados" aria-expanded={analyticsExpanded}> {analyticsExpanded ? "−" : "+"} </button>
              </div>
              {analyticsExpanded && <NavLink to={`${analyticsPath}/whatsapp-business`} className={linkClassName} onClick={closeMenu}>
                <FaWhatsapp className={styles.navIcon} aria-hidden="true" />
                <span>WhatsApp Business</span>
              </NavLink>}
            </div>
          </li>
        )}

        {usuario?.Papel === "EMPRESA" && (
          <li className={styles.navItem}>
            <NavLink to="/empresa/profissionais" end className={linkClassName} onClick={closeMenu}>
              <FaPerson className={styles.navIcon} aria-hidden="true" />
              <span>{t("nav.professionals")}</span>
            </NavLink>
          </li>
        )}
      </ul>
    </nav>
  );
}
