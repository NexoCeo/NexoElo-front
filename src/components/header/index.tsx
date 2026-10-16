import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { FaBars, FaCreditCard, FaMoon, FaSignOutAlt, FaSun, FaTimes, FaUser } from "react-icons/fa";
import styles from "./style.module.css";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { useNotification } from "@/context/NotificationContext";
import { getRoleBasePath } from "@/routes/role-paths";
import QrCode from "@/components/qrCode";
import NotificationBell from "@/components/notificationBell";
import { logout as endSession } from "@/services/logout-service";
import { defaultProfileImg, getProfileImageUrl } from "./profile-image";

interface HeaderProps {
  isMenuOpen: boolean;
  toggleMenu: () => void;
}

export default function Header({ isMenuOpen, toggleMenu }: HeaderProps) {
  const { theme, themeName, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { usuario, logout: clearUser } = useUser();
  const { showNotification } = useNotification();
  const basePath = getRoleBasePath(usuario?.Papel);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isFindMeOpen, setIsFindMeOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const fotoUrl = getProfileImageUrl(usuario?.FotoPerfil);
  const primeiroNome = usuario?.Nome?.trim().split(/\s+/)[0] || t("header.account");
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
        title: t("header.sessionEnded"),
        message: remoteLogoutFailed
          ? t("header.logoutOffline")
          : t("header.logoutSuccess"),
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
          aria-label={t("nav.open")}
          aria-expanded={isMenuOpen}
          aria-controls="app-sidebar"
          title={t("nav.open")}
        >
          <FaBars aria-hidden="true" />
        </button>

        <div className={styles.headerActions}>
          <NotificationBell />
          {canShowFindMe && (
            <button
              type="button"
              className={styles.findMeButton}
              style={{ color: theme.colors.text }}
              onClick={() => setIsFindMeOpen(true)}
            >
              {t("header.findMe")}
            </button>
          )}

          <div className={styles.profileWrapper} ref={profileMenuRef}>
            <button
              type="button"
              className={styles.profileButton}
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              aria-label={t("header.profileMenu")}
              aria-expanded={isProfileMenuOpen}
              aria-haspopup="menu"
            >
              <span className={styles.profileName}>{primeiroNome}</span>
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
                  <span>{t("header.profile")}</span>
                </Link>
                {canShowFindMe && (
                  <Link
                    to={`${basePath}/assinatura`}
                    style={{ color: theme.colors.text }}
                    onClick={() => setIsProfileMenuOpen(false)}
                    role="menuitem"
                  >
                    <FaCreditCard aria-hidden="true" />
                    <span>{t("header.subscription")}</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={styles.themeAction}
                  style={{ color: theme.colors.text }}
                  role="menuitem"
                  aria-label={themeName === "dark" ? t("header.useLightTheme") : t("header.useDarkTheme")}
                >
                  {themeName === "dark" ? (
                    <FaSun className={styles.sunIcon} aria-hidden="true" />
                  ) : (
                    <FaMoon className={styles.moonIcon} aria-hidden="true" />
                  )}
                  <span>{themeName === "dark" ? t("header.lightTheme") : t("header.darkTheme")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className={styles.logoutAction}
                  style={{ color: theme.colors.text }}
                  role="menuitem"
                >
                  <FaSignOutAlt aria-hidden="true" />
                  <span>{t("header.logout")}</span>
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
              aria-label={t("header.findMe")}
            >
              <button
                type="button"
                className={styles.closeModalButton}
                style={{ color: theme.colors.text }}
                onClick={() => setIsFindMeOpen(false)}
                aria-label={t("header.closeFindMe")}
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
