import { useEffect, useRef, type CSSProperties } from "react";
import { NavLink } from "react-router-dom";
import { FaCalendarAlt, FaChartBar, FaClock, FaHome, FaTimes, FaTools } from "react-icons/fa";
import { FaPerson } from "react-icons/fa6";
import styles from "./style.module.css";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { getRoleBasePath } from "@/routes/role-paths";

interface SidebarProps {
  isMenuOpen: boolean;
  closeMenu: () => void;
}

export default function Sidebar({ isMenuOpen, closeMenu }: SidebarProps) {
  const { theme } = useTheme();
  const { usuario } = useUser();
  const navRef = useRef<HTMLElement>(null);
  const basePath = getRoleBasePath(usuario?.Papel);
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
      aria-label="Navegacao principal"
      aria-hidden={!isMenuOpen}
    >
      <button
        type="button"
        className={styles.closeMenuIcon}
        style={{ color: theme.colors.text }}
        onClick={closeMenu}
        aria-label="Fechar menu"
      >
        <FaTimes aria-hidden="true" />
      </button>

      <ul className={styles.navList}>
        <li className={styles.navItem}>
          <NavLink to={`${basePath}/dashboard`} end className={linkClassName} onClick={closeMenu}>
            <FaHome className={styles.navIcon} aria-hidden="true" />
            <span>Dashboard</span>
          </NavLink>
        </li>

        <li className={styles.navItem}>
          <NavLink to={`${basePath}/agenda`} end className={linkClassName} onClick={closeMenu}>
            <FaCalendarAlt className={styles.navIcon} aria-hidden="true" />
            <span>Agenda</span>
          </NavLink>
        </li>

        {canManageSharedSettings && (
          <li className={styles.navItem}>
            <NavLink to={`${basePath}/servicos`} end className={linkClassName} onClick={closeMenu}>
              <FaTools className={styles.navIcon} aria-hidden="true" />
              <span>Servicos</span>
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
              <span>Funcionamento</span>
            </NavLink>
          </li>
        )}

        {canManageSharedSettings && (
          <li className={styles.navItem}>
            <NavLink to={`${basePath}/relatorios`} end className={linkClassName} onClick={closeMenu}>
              <FaChartBar className={styles.navIcon} aria-hidden="true" />
              <span>Relatorios</span>
            </NavLink>
          </li>
        )}

        {usuario?.Papel === "EMPRESA" && (
          <li className={styles.navItem}>
            <NavLink to="/empresa/profissionais" end className={linkClassName} onClick={closeMenu}>
              <FaPerson className={styles.navIcon} aria-hidden="true" />
              <span>Profissionais</span>
            </NavLink>
          </li>
        )}
      </ul>
    </nav>
  );
}
