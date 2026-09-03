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

export default function ProfessionalAccessGate({
  children,
}: {
  children: ReactNode;
}) {
  const { usuario } = useUser();

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
            ? "Nao foi possivel verificar seu vinculo"
            : checking
              ? "Verificando seu vinculo"
              : "Acesso aguardando aprovacao"}
        </h1>

        <p id="professional-access-description">
          {failed
            ? "Nao foi possivel confirmar a situacao do seu vinculo neste momento."
            : checking
              ? "Estamos verificando o status do seu vinculo com a empresa."
              : "Aguarde a aprovacao da solicitacao de vinculo. Esse processo pode levar de 1 a 3 dias."}
        </p>

        {statusBloqueado && (
          <div className={styles.statusBox}>
            <span>Status atual</span>

            <strong>
              {vinculo?.status}
            </strong>

            {vinculo?.empresaNome && (
              <small>
                Empresa:{" "}
                {vinculo.empresaNome}
              </small>
            )}
          </div>
        )}

        {statusBloqueado && (
          <small
            className={styles.helpText}
          >
            O acesso ao sistema sera
            liberado automaticamente
            quando o vinculo estiver
            APROVADO.
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
            Tentar novamente
          </button>
        )}
      </section>
    </div>
  );
}
