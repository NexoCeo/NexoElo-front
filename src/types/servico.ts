export type Servico = {
  Id: number;
  UsuarioFk?: number | null;
  ProfissionalId?: number | null;
  EmpresaId?: number | null;
  NomeServico: string;
  Valor: number;
  TempoEstimadoMinutos: number;
  ImagemServico?: string;
};

export type CreateServicoPayload = {
  UsuarioFk: number;
  ProfissionalId?: number | null;
  EmpresaId?: number | null;
  NomeServico: string;
  Valor: number;
  TempoEstimadoMinutos: number;
  ImagemServico?: File | null;
};

export type UpdateServicoPayload = Pick<
  CreateServicoPayload,
  "NomeServico" | "Valor" | "TempoEstimadoMinutos" | "ImagemServico"
>;
