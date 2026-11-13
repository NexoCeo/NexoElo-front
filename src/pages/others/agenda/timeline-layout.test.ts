import { describe, expect, it } from "vitest";
import { getTimelineBounds, layoutTimeline } from "./timeline-layout";

describe("linha do tempo da agenda", () => {
  it("mantém eventos consecutivos em uma única coluna e separa os cards visualmente", () => {
    const layout = layoutTimeline([
      { Id: 1, horario: "13:30", duracaoMinutos: 30 },
      { Id: 2, horario: "14:00", duracaoMinutos: 45 },
    ]);
    expect(layout.map(item => [item.Id, item.lane, item.laneCount])).toEqual([
      [1, 0, 1], [2, 0, 1],
    ]);
    expect(layout[0].top).toBeCloseTo(100 * 330 / 720);
    expect(layout[1].top).toBeCloseTo(100 * 360 / 720);
    expect(layout[0].top + layout[0].height).toBeLessThan(layout[1].top);
    expect(layout[0].endMinutes).toBe(14 * 60);
    expect(layout[1].endMinutes).toBe(14 * 60 + 45);
  });

  it("mostra eventos simultâneos em colunas lado a lado sem alterar os horários", () => {
    const layout = layoutTimeline([
      { Id: 3, horario: "14:00", duracaoMinutos: 45 },
      { Id: 2, horario: "13:30", duracaoMinutos: 60 },
    ]);
    expect(layout.map(item => item.Id)).toEqual([2, 3]);
    expect(layout.map(item => item.lane)).toEqual([0, 1]);
    expect(layout.map(item => item.laneCount)).toEqual([2, 2]);
    expect(layout[0].startMinutes).toBe(13 * 60 + 30);
    expect(layout[1].startMinutes).toBe(14 * 60);
    expect(layout[1].top).toBeGreaterThan(layout[0].top);
  });

  it("separa 3 agendamentos no mesmo horário em 3 raias", () => {
    const layout = layoutTimeline([
      { Id: 5, horario: "10:00", duracaoMinutos: 30 },
      { Id: 2, horario: "10:00", duracaoMinutos: 30 },
      { Id: 4, horario: "10:00", duracaoMinutos: 30 },
    ]);
    expect(layout.map(item => item.lane)).toEqual([0, 1, 2]);
    expect(layout.every(item => item.laneCount === 3)).toBe(true);
  });

  it("protege a legibilidade de eventos curtos e detecta colisões visuais", () => {
    const layout = layoutTimeline([
      { Id: 1, horario: "10:00", duracaoMinutos: 15 },
      { Id: 2, horario: "10:15", duracaoMinutos: 15 },
    ]);
    expect(layout.map(item => item.laneCount)).toEqual([2, 2]);
    expect(layout[0].endMinutes).toBe(10 * 60 + 15);
  });

  it("mantém eventos fora das 8h–20h na faixa horária correta", () => {
    const bounds = getTimelineBounds([
      { Id: 1, horario: "07:30", duracaoMinutos: 30 },
      { Id: 2, horario: "19:45", duracaoMinutos: 90 },
    ]);
    expect(bounds).toEqual({ startHour: 7, endHour: 22 });
    const layout = layoutTimeline([{ Id: 1, horario: "07:30", duracaoMinutos: 30 }], bounds.startHour, bounds.endHour);
    expect(layout[0].top).toBeCloseTo(100 * 30 / (15 * 60));
  });
});
