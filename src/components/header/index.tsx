import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { FaBars, FaMoon, FaSignOutAlt, FaSun, FaTimes, FaUser } from "react-icons/fa";
import styles from "./style.module.css";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { useNotification } from "@/context/NotificationContext";
import { getRoleBasePath } from "@/routes/role-paths";
import QrCode from "@/components/qrCode";
import { logout as endSession } from "@/services/logout-service";
import { defaultProfileImg, getProfileImageUrl } from "./profile-image";

interface HeaderProps {
  isMenuOpen: boolean;
  toggleMenu: () => void;
}

export default function Header({ isMenuOpen, toggleMenu }: HeaderProps) {
  const { theme, themeName, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { usuario, logout: clearUser } = useUser();
  const { showNotification } = useNotification();
  const basePath = getRoleBasePath(usuario?.Papel);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isFindMeOpen, setIsFindMeOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const fotoUrl = getProfileImageUrl(usuario?.FotoPerfil);
  const papel = usuario?.Papel?.toUpperCase();
  const canShowFindMe = papel === "EMPRESA" || papel === "AUTONOMO";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFindMeOpen(false);
      }
    }

    if (isFindMeOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => document.removeEventListener("keydown", handleEscape);
  }, [isFindMeOpen]);

  async function handleLogout() {
    let remoteLogoutFailed = false;
    try {
      await endSession();
    } catch {
      // The local session must still end when the API is unavailable.
      remoteLogoutFailed = true;
    } finally {
      clearUser();
      showNotification({
        type: remoteLogoutFailed ? "warning" : "success",
        title: "Sessao encerrada",
        message: remoteLogoutFailed
          ? "Voce saiu neste dispositivo, mas o servidor nao respondeu."
          : "Voce saiu da sua conta com seguranca.",
      });
      navigate("/global/login");
    }
  }

  return (
    <>
      <header
        className={styles.header}
        style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.bottom }}
      >
        <button
          type="button"
          className={styles.menuButton}
          style={{ color: theme.colors.text }}
          onClick={toggleMenu}
          aria-label="Abrir menu"
          aria-expanded={isMenuOpen}
          aria-controls="app-sidebar"
          title="Abrir menu"
        >
          <FaBars aria-hidden="true" />
        </button>

        <div className={styles.headerActions}>
          {canShowFindMe && (
            <button
              type="button"
              className={styles.findMeButton}
              style={{ color: theme.colors.text }}
              onClick={() => setIsFindMeOpen(true)}
            >
              Me encontre
            </button>
          )}

          <div className={styles.profileWrapper} ref={profileMenuRef}>
            <button
              type="button"
              className={styles.profileButton}
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              aria-label="Abrir menu do perfil"
              aria-expanded={isProfileMenuOpen}
              aria-haspopup="menu"
            >
              <img
                src={fotoUrl}
                className={styles.fotoPerfil}
                style={{ borderColor: theme.colors.bottom }}
                onError={(event) => {
                  event.currentTarget.src = defaultProfileImg;
                }}
                alt=""
              />
            </button>

            {isProfileMenuOpen && (
              <div
                className={styles.profileMenu}
                style={{ backgroundColor: theme.colors.background2 }}
                role="menu"
              >
                <Link
                  to={`${basePath}/perfil`}
                  style={{ color: theme.colors.text }}
                  onClick={() => setIsProfileMenuOpen(false)}
                  role="menuitem"
                >
                  <FaUser aria-hidden="true" />
                  <span>Meu perfil</span>
                </Link>
                <button
                  type="button"
                  onClick={toggleTheme}
                  style={{ color: theme.colors.text }}
                  role="menuitem"
                  aria-label={themeName === "dark" ? "Usar tema claro" : "Usar tema escuro"}
                >
                  {themeName === "dark" ? (
                    <FaSun aria-hidden="true" />
                  ) : (
                    <FaMoon aria-hidden="true" />
                  )}
                  <span>{themeName === "dark" ? "Tema claro" : "Tema escuro"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  style={{ color: theme.colors.text }}
                  role="menuitem"
                >
                  <FaSignOutAlt aria-hidden="true" />
                  <span>Sair</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {isFindMeOpen &&
        createPortal(
          <div className={styles.modalOverlay}>
            <div
              className={styles.findMeModal}
              style={{
                backgroundColor: theme.colors.background2,
                borderColor: theme.colors.bottom,
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Me encontre"
            >
              <button
                type="button"
                className={styles.closeModalButton}
                style={{ color: theme.colors.text }}
                onClick={() => setIsFindMeOpen(false)}
                aria-label="Fechar Me encontre"
              >
                <FaTimes aria-hidden="true" />
              </button>
              <QrCode />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
