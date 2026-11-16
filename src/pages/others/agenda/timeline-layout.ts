import type { DiaFuncionamentoKey, FuncionamentoConfig } from "@/types/funcionamento";

/**
 * Posição visual dos agendamentos na linha do tempo.
 *
 * Horários e durações vêm da API; quando há interseção real de períodos,
 * cada agendamento recebe uma coluna própria (sem alterar sua hora inicial).
 * O tamanho mínimo visual de 27 minutos garante legibilidade em serviços
 * muito curtos, e também participa da detecção de colisões.
 */
export type TimelineSource = {
  Id: number;
  horario: string;
  duracaoMinutos?: number | null;
};

export type TimelinePosition<T extends TimelineSource> = T & {
  startMinutes: number;
  endMinutes: number;
  top: number;
  height: number;
  lane: number;
  laneCount: number;
};

const MIN_VISIBLE_MINUTES = 27;
const CARD_GAP_MINUTES = 3;
const DEFAULT_DURATION_MINUTES = 30;

export function getTimelineBounds(
  items: TimelineSource[],
  standardStart = 8,
  standardEnd = 20,
) {
  let first = standardStart;
  let last = standardEnd;
  for (const item of items) {
    const [hours, minutes] = item.horario.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) continue;
    const startsAt = hours * 60 + minutes;
    const duration = Number.isFinite(item.duracaoMinutos) && (item.duracaoMinutos ?? 0) > 0
      ? item.duracaoMinutos!
      : DEFAULT_DURATION_MINUTES;
    first = Math.min(first, Math.floor(startsAt / 60));
    last = Math.max(last, Math.ceil((startsAt + duration) / 60));
  }
  return { startHour: first, endHour: last };
}

export function layoutTimeline<T extends TimelineSource>(
  items: T[],
  startHour = 8,
  endHour = 20,
): TimelinePosition<T>[] {
  const startOfCanvas = startHour * 60;
  const endOfCanvas = endHour * 60;
  const totalMinutes = Math.max(1, endOfCanvas - startOfCanvas);

  const positions = items.map(item => {
    const [hours, minutes] = item.horario.split(":").map(Number);
    const startsAt = hours * 60 + minutes;
    const duration = Number.isFinite(item.duracaoMinutos) && (item.duracaoMinutos ?? 0) > 0
      ? item.duracaoMinutos!
      : DEFAULT_DURATION_MINUTES;

    const visibleStart = Math.max(startOfCanvas, startsAt);
    const realEnd = startsAt + duration;
    // Visual cards taller than the actual time are accounted for in lane allocation.
    const visualEnd = Math.min(endOfCanvas, Math.max(realEnd, startsAt + MIN_VISIBLE_MINUTES));
    return {
      ...item,
      startMinutes: startsAt,
      endMinutes: realEnd,
      top: ((visibleStart - startOfCanvas) / totalMinutes) * 100,
      height: (Math.max(1, visualEnd - visibleStart - CARD_GAP_MINUTES) / totalMinutes) * 100,
      visualEnd,
      lane: 0,
      laneCount: 1,
    };
  }).sort((a, b) => a.startMinutes - b.startMinutes || a.Id - b.Id);

  let cluster: typeof positions = [];
  let clusterEnd = -Infinity;
  let laneEnds: number[] = [];

  const finishCluster = () => {
    const count = laneEnds.length;
    for (const event of cluster) event.laneCount = count;
    cluster = [];
    laneEnds = [];
    clusterEnd = -Infinity;
  };

  for (const event of positions) {
    if (cluster.length && event.startMinutes >= clusterEnd) finishCluster();

    let lane = laneEnds.findIndex(end => end <= event.startMinutes);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(event.visualEnd);
    } else {
      laneEnds[lane] = event.visualEnd;
    }
    event.lane = lane;
    cluster.push(event);
    clusterEnd = Math.max(clusterEnd, event.visualEnd);
  }
  if (cluster.length) finishCluster();

  return positions;
}

/** A escala da agenda segue o funcionamento daquele dia, não um intervalo fixo. */
export function getOperatingTimelineBounds(
  items: TimelineSource[],
  config: FuncionamentoConfig | null,
  weekday: number,
) {
  if (!config) return { ...getTimelineBounds(items), closed: false };
  const days: DiaFuncionamentoKey[] = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];
  const day = days[weekday];
  if (!day || !config[day]) {
    if (items.length === 0) return { startHour: 0, endHour: 0, closed: true };
    const first = Math.min(...items.map(item => Number(item.horario.slice(0, 2))));
    const last = Math.max(...items.map(item => {
      const [hour, minute] = item.horario.split(":").map(Number);
      return Math.ceil((hour * 60 + minute + (item.duracaoMinutos || 30)) / 60);
    }));
    return { ...getTimelineBounds(items, Math.max(0, first), Math.max(last, first + 1)), closed: true };
  }
  const hours = config.HorariosPorDia?.[day];
  const opening = hours?.Inicio ?? config.HorarioAbertura;
  const closing = hours?.Fim ?? config.HorarioFechamento;
  const parseMinutes = (value: string) => {
    const match = /^(\d{1,2}):(\d{2})/.exec(value);
    if (!match) return Number.NaN;
    return Number(match[1]) * 60 + Number(match[2]);
  };
  const start = parseMinutes(opening);
  const end = parseMinutes(closing);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { ...getTimelineBounds(items), closed: false };
  }
  return {
    ...getTimelineBounds(items, Math.floor(start / 60), Math.ceil(end / 60)),
    closed: false,
  };
}
