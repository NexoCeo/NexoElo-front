import {
  HubConnectionBuilder,
  HttpTransportType,
  LogLevel,
  type HubConnection,
} from "@microsoft/signalr";

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
  // A Vercel não mantém corretamente o transporte LongPolling do SignalR
  // através do rewrite /hubs/* (502). Por padrão, a aplicação usa o
  // revalidador/polling HTTP das páginas, sem abrir conexões que falhariam.
  // Uma URL direta de hub pode ser habilitada via variável de ambiente
  // quando o backend estiver acessível com a autenticação adequada.
  const directHubUrl = import.meta.env.VITE_AGENDA_SIGNALR_URL?.trim();
  if (!directHubUrl) {
    return {
      start: () => { onStatusChange("offline"); },
      stop: async () => undefined,
    };
  }

  const connection: HubConnection = new HubConnectionBuilder()
    .withUrl(directHubUrl, {
      withCredentials: true,
      transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling,
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
