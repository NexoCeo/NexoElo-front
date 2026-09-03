import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  FaCircleCheck,
  FaCircleExclamation,
  FaCircleXmark,
  FaXmark,
} from "react-icons/fa6";

import styles from "./style.module.css";

export type NotificationType =
  | "success"
  | "warning"
  | "error";

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
}

export interface NotificationItemData
  extends NotificationPayload {
  id: number;
}

interface NotificationItemProps {
  notification: NotificationItemData;
  onRemove: (id: number) => void;
}

interface NotificationStackProps {
  notifications: NotificationItemData[];
  onRemove: (id: number) => void;
}

/**
 * Duração padrão de TODAS as notificações.
 *
 * Caso futuramente seja necessário alterar,
 * basta modificar este valor.
 */
const NOTIFICATION_DURATION = 4000;

/**
 * Deve acompanhar aproximadamente
 * a duração da animação CSS de saída.
 */
const EXIT_ANIMATION_DURATION = 220;

const notificationConfig = {
  success: {
    icon: FaCircleCheck,
    className: styles.success,
  },

  warning: {
    icon: FaCircleExclamation,
    className: styles.warning,
  },

  error: {
    icon: FaCircleXmark,
    className: styles.error,
  },
} satisfies Record<
  NotificationType,
  {
    icon: React.ComponentType;
    className: string;
  }
>;

function NotificationItem({
  notification,
  onRemove,
}: NotificationItemProps) {
  const [leaving, setLeaving] =
    useState(false);

  const closingRef =
    useRef(false);

  const autoCloseTimerRef =
    useRef<number | null>(null);

  const removeTimerRef =
    useRef<number | null>(null);

  const handleClose = useCallback(() => {
    if (closingRef.current) {
      return;
    }

    closingRef.current = true;

    if (autoCloseTimerRef.current !== null) {
      window.clearTimeout(
        autoCloseTimerRef.current,
      );

      autoCloseTimerRef.current = null;
    }

    setLeaving(true);

    removeTimerRef.current =
      window.setTimeout(() => {
        onRemove(notification.id);
      }, EXIT_ANIMATION_DURATION);
  }, [notification.id, onRemove]);

  useEffect(() => {
    autoCloseTimerRef.current =
      window.setTimeout(() => {
        handleClose();
      }, NOTIFICATION_DURATION);

    return () => {
      if (
        autoCloseTimerRef.current !== null
      ) {
        window.clearTimeout(
          autoCloseTimerRef.current,
        );
      }

      if (removeTimerRef.current !== null) {
        window.clearTimeout(
          removeTimerRef.current,
        );
      }
    };
  }, [handleClose]);

  const config =
    notificationConfig[notification.type];

  const Icon = config.icon;

  return (
    <article
      className={`
        ${styles.notification}
        ${config.className}
        ${leaving ? styles.leaving : ""}
      `}
      role={
        notification.type === "error"
          ? "alert"
          : "status"
      }
    >
      <div
        className={styles.icon}
        aria-hidden="true"
      >
        <Icon />
      </div>

      <div className={styles.content}>
        <strong className={styles.title}>
          {notification.title}
        </strong>

        <p className={styles.message}>
          {notification.message}
        </p>
      </div>

      <button
        type="button"
        className={styles.closeButton}
        onClick={handleClose}
        aria-label="Fechar notificação"
        title="Fechar"
      >
        <FaXmark />
      </button>
    </article>
  );
}

export function NotificationStack({
  notifications,
  onRemove,
}: NotificationStackProps) {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div
      className={styles.container}
      aria-live="polite"
      aria-relevant="additions removals"
    >
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}