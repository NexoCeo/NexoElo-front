import { useCallback, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { resolverLocalizacao } from "@/services/localizacao-service";
import type {
  CadastroLocalizacaoPayload,
  Coordenadas,
  LocalizacaoResolvida,
} from "@/types/localizacao";

export type ModoCadastroLocalizacao =
  | "nao-selecionada"
  | "detectando"
  | "automatica"
  | "erro";

export type CadastroLocalizacaoController = {
  modo: ModoCadastroLocalizacao;
  cidadeId: number;
  localizacaoResolvida: LocalizacaoResolvida | null;
  loading: boolean;
  error: string;
  isValid: boolean;
  payload: CadastroLocalizacaoPayload | null;
  usarLocalizacaoAtual: () => Promise<CadastroLocalizacaoPayload>;
  reset: () => void;
};

type ApiError = string | { message?: string };

export class CadastroLocalizacaoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CadastroLocalizacaoError";
  }
}

function obterMensagemApi(error: unknown) {
  if (!isAxiosError<ApiError>(error)) return "Nao foi possivel identificar sua regiao.";
  const data = error.response?.data;
  if (typeof data === "string") {
    return data.trim() || "Nao foi possivel identificar sua regiao.";
  }
  return data?.message || "Nao foi possivel identificar sua regiao.";
}

function obterCoordenadas(): Promise<Coordenadas> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Seu navegador nao oferece geolocalizacao."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => {
        const messages: Record<number, string> = {
          1: "A permissao de localizacao foi negada.",
          2: "A localizacao do dispositivo esta indisponivel.",
          3: "A busca da localizacao excedeu o tempo limite.",
        };
        reject(new Error(messages[error.code] || "Nao foi possivel obter sua localizacao."));
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      },
    );
  });
}

export function useCadastroLocalizacao(): CadastroLocalizacaoController {
  const [modo, setModo] = useState<ModoCadastroLocalizacao>("nao-selecionada");
  const [cidadeId, setCidadeId] = useState(0);
  const [coordenadas, setCoordenadas] = useState<Coordenadas | null>(null);
  const [localizacaoResolvida, setLocalizacaoResolvida] =
    useState<LocalizacaoResolvida | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const usarLocalizacaoAtual = useCallback(async () => {
    if (modo === "automatica" && coordenadas && localizacaoResolvida) {
      return {
        latitude: coordenadas.latitude,
        longitude: coordenadas.longitude,
      };
    }

    setModo("detectando");
    setLoading(true);
    setError("");
    try {
      const currentCoordinates = await obterCoordenadas();
      const resolved = await resolverLocalizacao(currentCoordinates);
      setCoordenadas(currentCoordinates);
      setLocalizacaoResolvida(resolved);
      setCidadeId(resolved.CidadeId);
      setModo("automatica");
      return {
        latitude: currentCoordinates.latitude,
        longitude: currentCoordinates.longitude,
      };
    } catch (currentError) {
      const message = isAxiosError(currentError)
        ? obterMensagemApi(currentError)
        : currentError instanceof Error
          ? currentError.message
          : "Nao foi possivel identificar sua regiao.";
      setModo("erro");
      setCoordenadas(null);
      setLocalizacaoResolvida(null);
      setCidadeId(0);
      setError(message);
      throw new CadastroLocalizacaoError(message);
    } finally {
      setLoading(false);
    }
  }, [coordenadas, localizacaoResolvida, modo]);

  const reset = useCallback(() => {
    setModo("nao-selecionada");
    setCidadeId(0);
    setCoordenadas(null);
    setLocalizacaoResolvida(null);
    setLoading(false);
    setError("");
  }, []);

  const payload = useMemo<CadastroLocalizacaoPayload | null>(() => {
    if (modo === "automatica" && coordenadas && localizacaoResolvida) {
      return {
        latitude: coordenadas.latitude,
        longitude: coordenadas.longitude,
      };
    }

    return null;
  }, [coordenadas, localizacaoResolvida, modo]);

  return {
    modo,
    cidadeId,
    localizacaoResolvida,
    loading,
    error,
    isValid: payload != null,
    payload,
    usarLocalizacaoAtual,
    reset,
  };
}
