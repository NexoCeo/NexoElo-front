export type DiaFuncionamentoKey =
  | "Domingo"
  | "Segunda"
  | "Terca"
  | "Quarta"
  | "Quinta"
  | "Sexta"
  | "Sabado";

export type DiaFuncionamentoApi =
  | "DOMINGO"
  | "SEGUNDA"
  | "TERCA"
  | "QUARTA"
  | "QUINTA"
  | "SEXTA"
  | "SABADO";

export type FuncionamentoIntervalo = {
  Id?: number;
  Inicio: string;
  Fim: string;
};

export type FuncionamentoConfig = {
  Id?: number;
  UsuarioFk: number;
  Domingo: boolean;
  Segunda: boolean;
  Terca: boolean;
  Quarta: boolean;
  Quinta: boolean;
  Sexta: boolean;
  Sabado: boolean;
  HorarioAbertura: string;
  HorarioFechamento: string;
  IntervaloInicio?: string | null;
  IntervaloFim?: string | null;
  Intervalos: FuncionamentoIntervalo[];
};

export type FuncionamentoPayload = {
  UsuarioFk: number;
  DiasFuncionamento: DiaFuncionamentoApi[];
  HoraInicio: string;
  HoraFim: string;
  Intervalos: Array<{
    DiaFuncionamento: DiaFuncionamentoApi;
    HoraInicio: string;
    HoraFim: string;
  }>;
};
