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

    const onSuccess = ({ coords }: GeolocationPosition) =>
      resolve({ latitude: coords.latitude, longitude: coords.longitude });

    const messages: Record<number, string> = {
      1: "A permissão de localização foi negada.",
      2: "A localização do dispositivo está indisponível. Ative a localização e tente novamente.",
      3: "A busca da localização excedeu o tempo limite. Tente novamente.",
    };

    const onHighAccuracyFailure = (error: GeolocationPositionError) => {
      reject(new Error(messages[error.code] || "Não foi possível obter sua localização."));
    };

    // Para filtrar empresas precisamos apenas da cidade. A localização
    // aproximada da rede é muito mais rápida que aguardar GPS de alta precisão.
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (error) => {
        if (error.code === 1) {
          reject(new Error("Permita o acesso à localização nas configurações do navegador para continuar."));
          return;
        }

        // Apenas se a rede falhar, tente GPS para não bloquear o cadastro.
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          onHighAccuracyFailure,
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
        );
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 },
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
    if (modo === "automatica" && coordenadas) {
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
      // Coordenadas válidas são suficientes para o cadastro de autônomos e empresas.
      // A identificação da cidade é complementar e pode ficar indisponível.
      setCoordenadas(currentCoordinates);
      setModo("automatica");
      try {
        const resolved = await resolverLocalizacao(currentCoordinates);
        setLocalizacaoResolvida(resolved);
        setCidadeId(resolved.CidadeId);
      } catch (resolveError) {
        console.warn("Não foi possível identificar a cidade pelas coordenadas:", resolveError);
        setLocalizacaoResolvida(null);
        setCidadeId(0);
      }
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
    if (modo === "automatica" && coordenadas) {
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
