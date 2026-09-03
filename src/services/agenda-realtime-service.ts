import {
  HubConnectionBuilder,
  HttpTransportType,
  LogLevel,
  type HubConnection,
} from "@microsoft/signalr";
import { API_ORIGIN } from "./api";

export type AgendaRealtimeStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline";

export type AgendaUpdatedEvent = {
  Id?: number;
  id?: number;
  Data?: string;
  data?: string;
};

type AgendaRealtimeOptions = {
  onAgendaUpdated: (event: AgendaUpdatedEvent) => void;
  onStatusChange: (status: AgendaRealtimeStatus) => void;
};

export type AgendaRealtimeClient = {
  start: () => void;
  stop: () => Promise<void>;
};

export function createAgendaRealtimeClient({
  onAgendaUpdated,
  onStatusChange,
}: AgendaRealtimeOptions): AgendaRealtimeClient {
  const connection: HubConnection = new HubConnectionBuilder()
    .withUrl(`${API_ORIGIN}/hubs/agenda`, {
      withCredentials: true,
      transport: HttpTransportType.LongPolling,
    })
    .configureLogging(LogLevel.Warning)
    .withAutomaticReconnect([0, 2_000, 5_000, 10_000])
    .build();

  let stopped = false;
  let retryTimer: number | undefined;

  const scheduleRetry = () => {
    if (stopped || retryTimer !== undefined) return;

    retryTimer = window.setTimeout(() => {
      retryTimer = undefined;
      void startConnection();
    }, 5_000);
  };

  const startConnection = async () => {
    if (stopped || connection.state !== "Disconnected") return;

    onStatusChange("connecting");

    try {
      await connection.start();

      if (!stopped) {
        onStatusChange("connected");
      }
    } catch {
      if (!stopped) {
        onStatusChange("offline");
        scheduleRetry();
      }
    }
  };

  connection.on("AgendaAtualizada", onAgendaUpdated);

  connection.onreconnecting(() => {
    onStatusChange("reconnecting");
  });

  connection.onreconnected(() => {
    onStatusChange("connected");
  });

  connection.onclose(() => {
    if (!stopped) {
      onStatusChange("offline");
      scheduleRetry();
    }
  });

  return {
    start: () => {
      void startConnection();
    },

    stop: async () => {
      stopped = true;

      if (retryTimer !== undefined) {
        window.clearTimeout(retryTimer);
      }

      connection.off("AgendaAtualizada", onAgendaUpdated);
      await connection.stop();
    },
  };
}
