export type ResponsavelAgendamento = {
  Id: number;
  Nome: string;
  Email: string;
  Telefone: string;
  TipoUsuario: string;
  Slug?: string;
  FotoPerfil?: string;
};

export type UsuarioAgendamento = ResponsavelAgendamento;

export type ProfissionalAgendamento = {
  Id: number;
  Nome: string;
  VinculoStatus: string;
  FotoPerfil?: string;
};

export type HorarioDisponivel = {
  DataAgendamento: string;
  Horario: string;
};

export type Agendamento = {
  Id: number;
  ClienteId: number;
  ProfissionalId?: number | null;
  EmpresaId?: number | null;
  ServicoId: number;
  DataAgendamento: string;
  Valor: number;
  Taxa: number;
  ValorServico: number;
  Status: string;
  ClienteNome: string;
  ServicoNome: string;
  ProfissionalNome: string;
};

export type CreateAgendamentoPayload = {
  ClienteId: number;
  ResponsavelId: number;
  ProfissionalId?: number;
  ServicoId: number;
  DataAgendamento: string;
};
