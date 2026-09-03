import { useEffect, useState, type ReactNode } from "react";
import Header from "@/components/header";
import Sidebar from "@/components/sidebar";
import styles from "./style.module.css";

interface SharedRoleLayoutProps {
  children: ReactNode;
}

export default function SharedRoleLayout({ children }: SharedRoleLayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    </div>
  );
}
