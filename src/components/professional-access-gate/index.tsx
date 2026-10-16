import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  FaClock,
  FaExclamationTriangle,
  FaShieldAlt,
} from "react-icons/fa";

import { useUser } from "@/context/UserContext";

import {
  obterStatusVinculoProfissional,
  type VinculoProfissionalStatus,
} from "@/services/vinculo-service";

import { getStoredUser } from "@/services/auth-token";

import styles from "./style.module.css";
import { useLanguage } from "@/context/LanguageContext";

export default function ProfessionalAccessGate({
  children,
}: {
  children: ReactNode;
}) {
  const { usuario } = useUser();
  const { t } = useLanguage();

  const storedRole =
    getStoredUser<{ Papel?: string }>()?.Papel;

  const role = (
    usuario?.Papel ||
    storedRole ||
    ""
  ).toUpperCase();

  const [vinculo, setVinculo] =
    useState<VinculoProfissionalStatus | null>(
      null
    );

  const [failed, setFailed] =
    useState(false);

  const [attempt, setAttempt] =
    useState(0);

  /*
   * Verifica status do vínculo
   */
  useEffect(() => {
    if (role !== "PROFISSIONAL") {
      return;
    }

    let active = true;

    setVinculo(null);
    setFailed(false);

    obterStatusVinculoProfissional()
      .then((result) => {
        if (active) {
          setVinculo(result);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });

    return () => {
      active = false;
    };
  }, [attempt, role]);

  /*
   * Enquanto estiver pendente ou recusado,
   * verifica periodicamente se a empresa
   * aprovou o vínculo.
   */
  useEffect(() => {
    if (
      role !== "PROFISSIONAL" ||
      (
        vinculo?.status !== "PENDENTE" &&
        vinculo?.status !== "RECUSADO"
      )
    ) {
      return;
    }

    const interval =
      window.setInterval(() => {
        obterStatusVinculoProfissional()
          .then((result) => {
            setVinculo(result);
            setFailed(false);
          })
          .catch(() => undefined);
      }, 10000);

    return () =>
      window.clearInterval(interval);
  }, [role, vinculo?.status]);

  /*
   * Impede scroll enquanto o acesso
   * estiver bloqueado.
   */
  useEffect(() => {
    if (
      role !== "PROFISSIONAL" ||
      vinculo?.status === "APROVADO"
    ) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [role, vinculo?.status]);

  /*
   * Outros papéis não passam
   * por essa validação.
   */
  if (role !== "PROFISSIONAL") {
    return children;
  }

  /*
   * Somente APROVADO libera
   * as funcionalidades.
   */
  if (vinculo?.status === "APROVADO") {
    return children;
  }

  const checking =
    !vinculo && !failed;

  const statusBloqueado =
    vinculo?.status === "PENDENTE" ||
    vinculo?.status === "RECUSADO" ||
    vinculo?.status === "SEM_VINCULO";

  return (
    <div
      className={styles.backdrop}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="professional-access-title"
      aria-describedby="professional-access-description"
    >
      <section
        className={styles.modal}
        tabIndex={-1}
      >
        <span
          className={styles.icon}
          aria-hidden="true"
        >
          {failed ? (
            <FaExclamationTriangle />
          ) : checking ? (
            <FaShieldAlt />
          ) : (
            <FaClock />
          )}
        </span>

        <h1 id="professional-access-title">
          {failed
            ? t("gateProfessional.failedTitle")
            : checking
              ? t("gateProfessional.checkingTitle")
              : t("gateProfessional.waitTitle")}
        </h1>

        <p id="professional-access-description">
          {failed
            ? t("gateProfessional.failedDesc")
            : checking
              ? t("gateProfessional.checkingDesc")
              : t("gateProfessional.waitDesc")}
        </p>

        {statusBloqueado && (
          <div className={styles.statusBox}>
            <span>{t("gateProfessional.status")}</span>

            <strong>
              {vinculo?.status}
            </strong>

            {vinculo?.empresaNome && (
              <small>
                {t("gateProfessional.company")}:{" "}
                {vinculo.empresaNome}
              </small>
            )}
          </div>
        )}

        {statusBloqueado && (
          <small
            className={styles.helpText}
          >
            {t("gateProfessional.automatic")}
          </small>
        )}

        {failed && (
          <button
            type="button"
            className={
              styles.retryButton
            }
            onClick={() =>
              setAttempt(
                (value) => value + 1
              )
            }
          >
            {t("gateProfessional.retry")}
          </button>
        )}
      </section>
    </div>
  );
}
