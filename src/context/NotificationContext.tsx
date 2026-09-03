import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  NotificationStack,
  type NotificationItemData,
  type NotificationPayload,
} from "@/components/notification";

interface NotificationContextValue {
  showNotification: (
    notification: NotificationPayload,
  ) => void;
}

interface NotificationProviderProps {
  children: ReactNode;
}

const NotificationContext =
  createContext<
    NotificationContextValue | undefined
  >(undefined);

export function NotificationProvider({
  children,
}: NotificationProviderProps) {
  const [
    notifications,
    setNotifications,
  ] = useState<NotificationItemData[]>([]);

  const nextIdRef = useRef(0);

  const showNotification =
    useCallback(
      (
        notification: NotificationPayload,
      ) => {
        const id =
          ++nextIdRef.current;

        setNotifications((current) => {
          const alreadyVisible =
            current.some((item) =>
              item.type === notification.type &&
              item.title === notification.title &&
              item.message === notification.message
            );

          if (alreadyVisible) {
            return current;
          }

          return [
            ...current,
            {
              id,
              ...notification,
            },
          ];
        });
      },
      [],
    );

  const removeNotification =
    useCallback((id: number) => {
      setNotifications((current) =>
        current.filter(
          (notification) =>
            notification.id !== id,
        ),
      );
    }, []);

  const contextValue =
    useMemo(
      () => ({
        showNotification,
      }),
      [showNotification],
    );

  return (
    <NotificationContext.Provider
      value={contextValue}
    >
      {children}

      <NotificationStack
        notifications={notifications}
        onRemove={removeNotification}
      />
    </NotificationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- Public hook for this provider.
export function useNotification() {
  const context =
    useContext(NotificationContext);

  if (!context) {
    throw new Error(
      "useNotification deve ser utilizado dentro de NotificationProvider.",
    );
  }

  return context;
}
