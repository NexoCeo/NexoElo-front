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
  ResponsavelId?: number;
  DataAgendamento: string;
  Valor: number;
  Taxa: number;
  ValorServico: number;
  /** Duração real cadastrada para o serviço, em minutos. */
  DuracaoMinutos?: number;
  Status: string;
  MotivoCancelamento?: string | null;
  ClienteNome: string;
  ServicoNome: string;
  ProfissionalNome: string;
  Profissionais?: { Id: number; Nome: string; FotoPerfil?: string | null }[];
  ServicosDetalhados?: {
    Id: number;
    Nome: string;
    ProfissionalId?: number | null;
    ProfissionalNome: string;
  }[];
};

export type CreateAgendamentoPayload = {
  ClienteId: number;
  ResponsavelId: number;
  ProfissionalId?: number;
  ServicoId: number;
  ServicoIds?: number[];
  Atendimentos?: { ServicoId: number; ProfissionalId: number }[];
  DataAgendamento: string;
};
