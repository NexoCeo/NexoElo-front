import { isAxiosError } from "axios";
import api from "./api";
import type {
  DiaFuncionamentoApi,
  DiaFuncionamentoKey,
  FuncionamentoConfig,
  FuncionamentoIntervalo,
  FuncionamentoPayload,
} from "@/types/funcionamento";

type ApiRecord = Record<string, unknown>;

const DIAS: DiaFuncionamentoKey[] = [
  "Domingo",
  "Segunda",
  "Terca",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sabado",
];

const DIA_API_POR_UI: Record<DiaFuncionamentoKey, DiaFuncionamentoApi> = {
  Domingo: "DOMINGO",
  Segunda: "SEGUNDA",
  Terca: "TERCA",
  Quarta: "QUARTA",
  Quinta: "QUINTA",
  Sexta: "SEXTA",
  Sabado: "SABADO",
};

type BlocoDisponivel = FuncionamentoIntervalo & {
  Dia: DiaFuncionamentoKey;
};

function pickBoolean(data: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = data[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalizedValue = value.toLowerCase();
      if (normalizedValue === "true") return true;
      if (normalizedValue === "false") return false;
    }
  }

  return false;
}

function pickNumber(data: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = data[key];

    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      const parsedValue = Number(value);
      if (!Number.isNaN(parsedValue)) {
        return parsedValue;
      }
    }
  }

  return 0;
}

function pickString(data: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

function normalizeTime(value: string, fallback = "") {
  if (!value) {
    return fallback;
  }

  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return fallback;
  }

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function toApiTime(value?: string | null) {
  if (!value) {
    return null;
  }

  return normalizeTime(value) || null;
}

function normalizeDayName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeDia(value: unknown): DiaFuncionamentoKey | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return DIAS[value] ?? null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = normalizeDayName(value);
  return DIAS.find((dia) => normalizeDayName(dia) === normalizedValue) ?? null;
}

function getDiasFromArray(data: ApiRecord) {
  const diasRaw = data.DiasFuncionamento ?? data.diasFuncionamento ?? data.DiasSemana ?? data.diasSemana;

  if (!Array.isArray(diasRaw)) {
    return new Set<string>();
  }

  return new Set(
    diasRaw
      .map(normalizeDia)
      .filter((dia): dia is DiaFuncionamentoKey => Boolean(dia)),
  );
}

function normalizeBlocoDisponivel(data: ApiRecord): BlocoDisponivel | null {
  const inicio = normalizeTime(
    pickString(data, [
      "Inicio",
      "inicio",
      "HorarioInicio",
      "horarioInicio",
      "IntervaloInicio",
      "intervaloInicio",
      "HoraInicio",
      "horaInicio",
    ]),
  );
  const fim = normalizeTime(
    pickString(data, [
      "Fim",
      "fim",
      "HorarioFim",
      "horarioFim",
      "IntervaloFim",
      "intervaloFim",
      "HoraFim",
      "horaFim",
    ]),
  );

  const dia = normalizeDia(
    data.DiaFuncionamento ?? data.diaFuncionamento ?? data.Dia ?? data.dia,
  );

  if (!dia || !inicio || !fim) {
    return null;
  }

  return {
    Dia: dia,
    Inicio: inicio,
    Fim: fim,
  };
}

function getBlocosDisponiveis(data: ApiRecord) {
  const intervalosRaw =
    data.Intervalos ??
    data.intervalos ??
    data.IntervalosFuncionamento ??
    data.intervalosFuncionamento ??
    data.Pausas ??
    data.pausas;

  if (Array.isArray(intervalosRaw)) {
    return intervalosRaw
      .filter((intervalo): intervalo is ApiRecord => Boolean(intervalo) && typeof intervalo === "object")
      .map(normalizeBlocoDisponivel)
      .filter((intervalo): intervalo is BlocoDisponivel => Boolean(intervalo));
  }

  return [];
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function consolidarBlocos(blocos: BlocoDisponivel[]) {
  return [...blocos]
    .sort((a, b) => timeToMinutes(a.Inicio) - timeToMinutes(b.Inicio))
    .reduce<FuncionamentoIntervalo[]>((acc, bloco) => {
      const ultimo = acc.at(-1);

      if (!ultimo || timeToMinutes(bloco.Inicio) > timeToMinutes(ultimo.Fim)) {
        acc.push({ Inicio: bloco.Inicio, Fim: bloco.Fim });
        return acc;
      }

      if (timeToMinutes(bloco.Fim) > timeToMinutes(ultimo.Fim)) {
        ultimo.Fim = bloco.Fim;
      }

      return acc;
    }, []);
}

function reconstruirExpediente(
  data: ApiRecord,
  blocos: BlocoDisponivel[],
  diasSelecionados: Set<DiaFuncionamentoKey>,
) {
  const diaReferencia = DIAS.find((dia) => diasSelecionados.has(dia) && blocos.some((bloco) => bloco.Dia === dia));
  const blocosDoDia = consolidarBlocos(
    diaReferencia ? blocos.filter((bloco) => bloco.Dia === diaReferencia) : [],
  );

  if (blocosDoDia.length === 0) {
    return {
      abertura: normalizeTime(
        pickString(data, ["HorarioAbertura", "horarioAbertura", "HorarioInicio", "horarioInicio", "HoraInicio", "horaInicio"]),
        "08:00",
      ),
      fechamento: normalizeTime(
        pickString(data, ["HorarioFechamento", "horarioFechamento", "HorarioFim", "horarioFim", "HoraFim", "horaFim"]),
        "18:00",
      ),
      pausas: [] as FuncionamentoIntervalo[],
    };
  }

  const pausas = blocosDoDia.slice(0, -1).map((bloco, index) => ({
    Inicio: bloco.Fim,
    Fim: blocosDoDia[index + 1].Inicio,
  }));

  return {
    abertura: blocosDoDia[0].Inicio,
    fechamento: blocosDoDia.at(-1)?.Fim ?? blocosDoDia[0].Fim,
    pausas,
  };
}

export function criarFuncionamentoPadrao(usuarioId: number): FuncionamentoConfig {
  return {
    UsuarioFk: usuarioId,
    Domingo: false,
    Segunda: true,
    Terca: true,
    Quarta: true,
    Quinta: true,
    Sexta: true,
    Sabado: false,
    HorarioAbertura: "08:00",
    HorarioFechamento: "18:00",
    IntervaloInicio: null,
    IntervaloFim: null,
    Intervalos: [],
  };
}

export function normalizeFuncionamento(data: ApiRecord, usuarioId: number): FuncionamentoConfig {
  const diasArray = getDiasFromArray(data);
  const hasDiasArray = diasArray.size > 0;
  const blocosDisponiveis = getBlocosDisponiveis(data);
  const diasDosBlocos = new Set(blocosDisponiveis.map((bloco) => bloco.Dia));
  const normalizedDays = DIAS.reduce((acc, dia) => {
    acc[dia] = hasDiasArray
      ? diasArray.has(dia)
      : diasDosBlocos.size > 0
        ? diasDosBlocos.has(dia)
        : pickBoolean(data, [dia, dia.toLowerCase()]);
    return acc;
  }, {} as Record<DiaFuncionamentoKey, boolean>);
  const diasSelecionados = new Set(
    DIAS.filter((dia) => normalizedDays[dia]),
  );
  const expediente = reconstruirExpediente(data, blocosDisponiveis, diasSelecionados);
  const primeiraPausa = expediente.pausas[0];

  return {
    UsuarioFk: pickNumber(data, ["UsuarioFk", "usuarioFk", "UsuarioId", "usuarioId"]) || usuarioId,
    ...normalizedDays,
    HorarioAbertura: expediente.abertura,
    HorarioFechamento: expediente.fechamento,
    IntervaloInicio: primeiraPausa?.Inicio ?? null,
    IntervaloFim: primeiraPausa?.Fim ?? null,
    Intervalos: expediente.pausas,
  };
}

export function buildFuncionamentoPayload(config: FuncionamentoConfig): FuncionamentoPayload {
  const diasFuncionamento = DIAS
    .filter((dia) => config[dia])
    .map((dia) => DIA_API_POR_UI[dia]);
  const horarioAbertura = toApiTime(config.HorarioAbertura) ?? "08:00";
  const horarioFechamento = toApiTime(config.HorarioFechamento) ?? "18:00";
  const pausas = config.Intervalos
    .filter((intervalo) => intervalo.Inicio && intervalo.Fim)
    .map((intervalo) => ({
      Inicio: toApiTime(intervalo.Inicio) ?? "00:00",
      Fim: toApiTime(intervalo.Fim) ?? "00:00",
    }))
    .sort((a, b) => timeToMinutes(a.Inicio) - timeToMinutes(b.Inicio));
  const intervalos = diasFuncionamento.flatMap((dia) => {
    const blocos: FuncionamentoPayload["Intervalos"] = [];
    let cursor = timeToMinutes(horarioAbertura);

    for (const pausa of pausas) {
      const inicioPausa = timeToMinutes(pausa.Inicio);
      const fimPausa = timeToMinutes(pausa.Fim);

      if (cursor < inicioPausa) {
        blocos.push({
          DiaFuncionamento: dia,
          HoraInicio: minutesToTime(cursor),
          HoraFim: minutesToTime(inicioPausa),
        });
      }

      cursor = Math.max(cursor, fimPausa);
    }

    const fechamento = timeToMinutes(horarioFechamento);
    if (cursor < fechamento) {
      blocos.push({
        DiaFuncionamento: dia,
        HoraInicio: minutesToTime(cursor),
        HoraFim: minutesToTime(fechamento),
      });
    }

    return blocos;
  });

  return {
    UsuarioFk: config.UsuarioFk,
    DiasFuncionamento: diasFuncionamento,
    HoraInicio: horarioAbertura,
    HoraFim: horarioFechamento,
    Intervalos: intervalos,
  };
}

export async function obterFuncionamento(usuarioId: number) {
  try {
    const response = await api.get<ApiRecord>(`/Funcionamento/${usuarioId}`);
    return normalizeFuncionamento(response.data, usuarioId);
  } catch (error) {
    if (isAxiosError(error) && (error.response?.status === 404 || (error.response?.status ?? 0) >= 500)) {
      return criarFuncionamentoPadrao(usuarioId);
    }

    throw error;
  }
}

export async function salvarFuncionamento(usuarioId: number, config: FuncionamentoConfig) {
  const payload = buildFuncionamentoPayload({
    ...config,
    UsuarioFk: usuarioId,
  });

  let response;

  try {
    response = await api.put<ApiRecord>(`/Funcionamento/${usuarioId}`, payload);
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status ?? 0 : 0;

    if (![404, 405, 500].includes(status)) {
      throw error;
    }

    response = await api.patch<ApiRecord>(`/Funcionamento/${usuarioId}`, payload);
  }

  return normalizeFuncionamento(response.data, usuarioId);
}
