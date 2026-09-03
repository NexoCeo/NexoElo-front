import api from "./api";
import type {
  Agendamento,
  CreateAgendamentoPayload,
  HorarioDisponivel,
  ProfissionalAgendamento,
  ResponsavelAgendamento,
  UsuarioAgendamento,
} from "@/types/agendamento";

type ApiRecord = Record<string, unknown>;

function pickString(data: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
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

function normalizeUsuario(usuario: ApiRecord): UsuarioAgendamento {
  return {
    Id: pickNumber(usuario, ["Id", "id", "UsuarioId", "usuarioId"]),
    Nome: pickString(usuario, ["Nome", "nome", "Name", "name"]),
    Email: pickString(usuario, ["Email", "email"]),
    Telefone: pickString(usuario, ["Telefone", "telefone"]),
    TipoUsuario: pickString(usuario, ["TipoUsuario", "tipoUsuario", "Papel", "papel"]).toUpperCase(),
    Slug: pickString(usuario, ["Slug", "slug"]),
    FotoPerfil: pickString(usuario, ["FotoPerfil", "fotoPerfil"]),
  };
}

function normalizeProfissional(profissional: ApiRecord): ProfissionalAgendamento {
  return {
    Id: pickNumber(profissional, ["Id", "id", "ProfissionalId", "profissionalId"]),
    Nome: pickString(profissional, ["Nome", "nome"]),
    VinculoStatus: pickString(profissional, ["VinculoStatus", "vinculoStatus"]).toUpperCase(),
    FotoPerfil: pickString(profissional, ["FotoPerfil", "fotoPerfil"]),
  };
}

function normalizeAgendamento(agendamento: ApiRecord): Agendamento {
  return {
    Id: pickNumber(agendamento, ["Id", "id", "AgendamentoId", "agendamentoId"]),
    ClienteId: pickNumber(agendamento, ["ClienteId", "clienteId"]),
    ProfissionalId: pickNumber(agendamento, ["ProfissionalId", "profissionalId"]) || null,
    EmpresaId: pickNumber(agendamento, ["EmpresaId", "empresaId"]) || null,
    ServicoId: pickNumber(agendamento, ["ServicoId", "servicoId"]),
    DataAgendamento: pickString(agendamento, ["DataAgendamento", "dataAgendamento", "DataHora", "dataHora"]),
    Valor: pickNumber(agendamento, ["Valor", "valor"]),
    Taxa: pickNumber(agendamento, ["Taxa", "taxa"]),
    ValorServico: pickNumber(agendamento, ["ValorServico", "valorServico"]),
    Status: pickString(agendamento, ["Status", "status"]) || "AGENDADO",
    ClienteNome: pickString(agendamento, ["ClienteNome", "clienteNome"]),
    ServicoNome: pickString(agendamento, ["ServicoNome", "servicoNome"]),
    ProfissionalNome: pickString(agendamento, ["ProfissionalNome", "profissionalNome"]),
  };
}

function normalizeHorarioDisponivel(horario: ApiRecord): HorarioDisponivel {
  return {
    DataAgendamento: pickString(horario, ["DataAgendamento", "dataAgendamento"]),
    Horario: pickString(horario, ["Horario", "horario"]),
  };
}

export function formatAgendaDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function listarUsuariosAgendamento() {
  const response = await api.get<ApiRecord[]>("/AgendaPublica/prestadores");

  return Array.isArray(response.data) ? response.data.map(normalizeUsuario) : [];
}

export async function listarResponsaveisAgendamento() {
  const usuarios = await listarUsuariosAgendamento();
  const responsaveis = ["EMPRESA", "AUTONOMO"];

  return usuarios.filter((usuario) => responsaveis.includes(usuario.TipoUsuario)) as ResponsavelAgendamento[];
}

export async function listarProfissionaisAgendamento(empresaId: number) {
  const response = await api.get<ApiRecord[]>(
    `/AgendaPublica/empresa/${empresaId}/profissionais`,
  );

  return Array.isArray(response.data)
    ? response.data
        .map(normalizeProfissional)
        .filter((profissional) => profissional.VinculoStatus === "APROVADO")
    : [];
}

export async function listarHistoricoAgendamentos(usuarioId: number) {
  const response = await api.get<ApiRecord[]>(`/Agendamento/historico/${usuarioId}`);

  return Array.isArray(response.data) ? response.data.map(normalizeAgendamento) : [];
}

export async function listarAgendaPorData(
  usuarioId: number,
  data: string,
  profissionalId?: number,
  signal?: AbortSignal,
) {
  const response = await api.get<ApiRecord[]>(
    `/Agendamento/agenda/${usuarioId}`,
    {
      params: {
        data,
        ...(profissionalId ? { profissionalId } : {}),
      },
      signal,
    },
  );

  return Array.isArray(response.data)
    ? response.data.map(normalizeAgendamento)
    : [];
}

export async function listarHorariosDisponiveis(params: {
  responsavelId: number;
  profissionalId?: number;
  servicoId: number;
  data: string;
}) {
  const response = await api.get<ApiRecord[]>("/Agendamento/horarios-disponiveis", {
    params,
  });

  return Array.isArray(response.data)
    ? response.data.map(normalizeHorarioDisponivel)
    : [];
}

export async function listarAgendaPorPeriodo(
  usuarioId: number,
  inicio: string,
  fim: string,
  profissionalId?: number,
  signal?: AbortSignal,
) {
  const response = await api.get<ApiRecord[]>(
    `/Agendamento/agenda/${usuarioId}/periodo`,
    {
      params: {
        inicio,
        fim,
        ...(profissionalId ? { profissionalId } : {}),
      },
      signal,
    },
  );

  return Array.isArray(response.data)
    ? response.data.map(normalizeAgendamento)
    : [];
}

export async function criarAgendamento(payload: CreateAgendamentoPayload) {
  const response = await api.post("/Agendamento", payload);
  return response.data;
}

export async function atualizarStatusAgendamento(
  agendamentoId: number,
  status: "CANCELADO" | "CONCLUIDO",
) {
  const response = await api.patch<ApiRecord>(
    `/Agendamento/${agendamentoId}/status`,
    { status },
  );

  return normalizeAgendamento(response.data);
}

export async function concluirAgendamentosDoDiaAtual() {
  const response = await api.patch<ApiRecord>(
    "/Agendamento/status/concluir-dia-atual",
  );

  return pickNumber(response.data, ["quantidade", "Quantidade"]);
}
