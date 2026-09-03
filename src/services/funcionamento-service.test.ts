import { describe, expect, it } from "vitest";
import {
  buildFuncionamentoPayload,
  criarFuncionamentoPadrao,
  normalizeFuncionamento,
} from "./funcionamento-service";

describe("funcionamento-service", () => {
  it("converte expediente e pausas em blocos disponiveis para cada dia selecionado", () => {
    const config = criarFuncionamentoPadrao(7);
    config.HorarioAbertura = "08:00";
    config.HorarioFechamento = "17:00";
    config.Intervalos = [
      { Inicio: "11:00", Fim: "12:00" },
      { Inicio: "15:00", Fim: "15:30" },
    ];

    const payload = buildFuncionamentoPayload(config);

    expect(payload.DiasFuncionamento).toEqual(["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA"]);
    expect(payload.Intervalos).toHaveLength(15);
    expect(payload.Intervalos.slice(0, 3)).toEqual([
      { DiaFuncionamento: "SEGUNDA", HoraInicio: "08:00", HoraFim: "11:00" },
      { DiaFuncionamento: "SEGUNDA", HoraInicio: "12:00", HoraFim: "15:00" },
      { DiaFuncionamento: "SEGUNDA", HoraInicio: "15:30", HoraFim: "17:00" },
    ]);
    expect(payload.Intervalos.slice(-3)).toEqual([
      { DiaFuncionamento: "SEXTA", HoraInicio: "08:00", HoraFim: "11:00" },
      { DiaFuncionamento: "SEXTA", HoraInicio: "12:00", HoraFim: "15:00" },
      { DiaFuncionamento: "SEXTA", HoraInicio: "15:30", HoraFim: "17:00" },
    ]);
  });

  it("reconstroi o expediente e as pausas ao carregar os blocos do backend", () => {
    const data = {
      UsuarioFk: 7,
      DiasFuncionamento: ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA"],
      Intervalos: [
        { DiaFuncionamento: "SEGUNDA", HoraInicio: "08:00", HoraFim: "11:00" },
        { DiaFuncionamento: "SEGUNDA", HoraInicio: "12:00", HoraFim: "15:00" },
        { DiaFuncionamento: "SEGUNDA", HoraInicio: "15:30", HoraFim: "17:00" },
        { DiaFuncionamento: "TERCA", HoraInicio: "08:00", HoraFim: "11:00" },
        { DiaFuncionamento: "TERCA", HoraInicio: "12:00", HoraFim: "15:00" },
        { DiaFuncionamento: "TERCA", HoraInicio: "15:30", HoraFim: "17:00" },
      ],
    };

    const config = normalizeFuncionamento(data, 7);

    expect(config).toMatchObject({
      Segunda: true,
      Terca: true,
      Quarta: true,
      Quinta: true,
      Sexta: true,
      Domingo: false,
      Sabado: false,
      HorarioAbertura: "08:00",
      HorarioFechamento: "17:00",
      Intervalos: [
        { Inicio: "11:00", Fim: "12:00" },
        { Inicio: "15:00", Fim: "15:30" },
      ],
    });
  });

  it("une blocos consecutivos sem inventar uma pausa", () => {
    const config = normalizeFuncionamento({
      UsuarioFk: 7,
      DiasFuncionamento: ["SEGUNDA"],
      Intervalos: [
        { DiaFuncionamento: "SEGUNDA", HoraInicio: "08:00", HoraFim: "12:00" },
        { DiaFuncionamento: "SEGUNDA", HoraInicio: "12:00", HoraFim: "17:00" },
      ],
    }, 7);

    expect(config.HorarioAbertura).toBe("08:00");
    expect(config.HorarioFechamento).toBe("17:00");
    expect(config.Intervalos).toEqual([]);
  });
});
