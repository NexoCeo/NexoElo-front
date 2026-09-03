import api from "./api";

/* =========================================================
   STATUS DO VÍNCULO DO PROFISSIONAL
========================================================= */

export type VinculoProfissionalStatus = {
  status: "SEM_VINCULO" | "PENDENTE" | "APROVADO" | "RECUSADO";
  empresaId?: number | null;
  empresaNome?: string | null;
  dataSolicitacao?: string | null;
};

type VinculoProfissionalStatusApi = {
  VinculoStatus?: string;
  vinculoStatus?: string;

  Status?: string;
  status?: string;

  EmpresaId?: number | null;
  empresaId?: number | null;

  EmpresaNome?: string | null;
  empresaNome?: string | null;

  DataSolicitacao?: string | null;
  dataSolicitacao?: string | null;
};

export async function obterStatusVinculoProfissional(): Promise<VinculoProfissionalStatus> {
  const response = await api.get<VinculoProfissionalStatusApi>(
    "/vinculos/profissional/status",
  );

  const data = response.data;

  const status =
    data.VinculoStatus ??
    data.vinculoStatus ??
    data.Status ??
    data.status ??
    "SEM_VINCULO";

  return {
    status:
      status.toUpperCase() as VinculoProfissionalStatus["status"],

    empresaId:
      data.EmpresaId ??
      data.empresaId ??
      null,

    empresaNome:
      data.EmpresaNome ??
      data.empresaNome ??
      null,

    dataSolicitacao:
      data.DataSolicitacao ??
      data.dataSolicitacao ??
      null,
  };
}

/* =========================================================
   EMPRESAS DISPONÍVEIS PARA NOVO VÍNCULO
========================================================= */

export type EmpresaVinculo = {
  Id: number;
  Nome: string;
};

type EmpresaVinculoApi = {
  Id?: number;
  id?: number;

  EmpresaId?: number;
  empresaId?: number;

  UsuarioId?: number;
  usuarioId?: number;

  Nome?: string;
  nome?: string;

  EmpresaNome?: string;
  empresaNome?: string;

  NomeFantasia?: string;
  nomeFantasia?: string;
};

export async function listarEmpresasParaNovoVinculo(
  profissionalId: number,
): Promise<EmpresaVinculo[]> {
  const response = await api.get<EmpresaVinculoApi[]>(
    `/vinculos/profissional/${profissionalId}/empresas`,
  );

  return response.data
    .map((empresa) => ({
      Id:
        empresa.Id ??
        empresa.id ??
        empresa.EmpresaId ??
        empresa.empresaId ??
        empresa.UsuarioId ??
        empresa.usuarioId ??
        0,

      Nome:
        empresa.Nome ??
        empresa.nome ??
        empresa.EmpresaNome ??
        empresa.empresaNome ??
        empresa.NomeFantasia ??
        empresa.nomeFantasia ??
        "",
    }))
    .filter((empresa) => empresa.Id > 0);
}

/* =========================================================
   SOLICITAR NOVO VÍNCULO
========================================================= */

export async function solicitarNovoVinculo(
  profissionalId: number,
  empresaId: number,
): Promise<void> {
  await api.post(
    `/vinculos/profissional/${profissionalId}/solicitacoes`,
    {
      empresaId,
    },
  );
}

/* =========================================================
   SOLICITAÇÕES DE VÍNCULO DA EMPRESA
========================================================= */

export type SolicitacaoVinculo = {
  VinculoId: number;
  ProfissionalId: number;
  Nome: string;
  Email?: string | null;
  Telefone?: string | null;
  Status: string;
  DataSolicitacao?: string | null;
};

type SolicitacaoVinculoApi = {
  id?: number;
  Id?: number;

  vinculoId?: number;
  VinculoId?: number;

  profissionalId?: number;
  ProfissionalId?: number;

  profissionalNome?: string;
  ProfissionalNome?: string;

  nome?: string;
  Nome?: string;

  profissionalEmail?: string | null;
  ProfissionalEmail?: string | null;

  email?: string | null;
  Email?: string | null;

  profissionalTelefone?: string | null;
  ProfissionalTelefone?: string | null;

  telefone?: string | null;
  Telefone?: string | null;

  vinculoStatus?: string;
  VinculoStatus?: string;

  status?: string;
  Status?: string;

  dataSolicitacao?: string | null;
  DataSolicitacao?: string | null;
};

export async function listarSolicitacoesVinculo(
  empresaId: number,
): Promise<SolicitacaoVinculo[]> {
  const response = await api.get<SolicitacaoVinculoApi[]>(
    `/vinculos/empresa/${empresaId}/solicitacoes`,
  );

  return response.data.map((item) => ({
    VinculoId:
      item.VinculoId ??
      item.vinculoId ??
      item.Id ??
      item.id ??
      0,

    ProfissionalId:
      item.ProfissionalId ??
      item.profissionalId ??
      0,

    Nome:
      item.Nome ??
      item.nome ??
      item.ProfissionalNome ??
      item.profissionalNome ??
      "",

    Email:
      item.Email ??
      item.email ??
      item.ProfissionalEmail ??
      item.profissionalEmail ??
      null,

    Telefone:
      item.Telefone ??
      item.telefone ??
      item.ProfissionalTelefone ??
      item.profissionalTelefone ??
      null,

    Status:
      item.Status ??
      item.status ??
      item.VinculoStatus ??
      item.vinculoStatus ??
      "PENDENTE",

    DataSolicitacao:
      item.DataSolicitacao ??
      item.dataSolicitacao ??
      null,
  }));
}

/* =========================================================
   APROVAR OU RECUSAR SOLICITAÇÃO
========================================================= */

export async function responderSolicitacaoVinculo(
  empresaId: number,
  solicitacaoId: number,
  status: "APROVADO" | "RECUSADO",
): Promise<void> {
  await api.patch(
    `/vinculos/empresa/${empresaId}/solicitacoes/${solicitacaoId}`,
    {
      status,
    },
  );
}