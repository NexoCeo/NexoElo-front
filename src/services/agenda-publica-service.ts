import api from "./api";
import type { AgendaPublica } from "@/types/agenda-publica";

type ApiRecord = Record<string, unknown>;

export type EmpresaCadastro = {
  Id: number;
  Nome: string;
};

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

export function getClienteFinalAgendamentoUrl(slug: string) {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "";

  return `${origin}/cliente-final/agendar/${encodeURIComponent(slug)}`;
}

export async function obterAgendaPublica(slug: string) {
  const response = await api.get<ApiRecord>(
    `/AgendaPublica/${encodeURIComponent(slug)}`,
  );

  const data = response.data;

  return {
    UsuarioId: pickNumber(data, ["UsuarioId", "usuarioId"]),
    Nome: pickString(data, ["Nome", "nome"]),
    TipoUsuario: pickString(
      data,
      ["TipoUsuario", "tipoUsuario"],
    ).toUpperCase(),
    Slug: pickString(data, ["Slug", "slug"]),
    FotoPerfil: pickString(data, ["FotoPerfil", "fotoPerfil"]),
    UrlAgendamento: pickString(
      data,
      ["UrlAgendamento", "urlAgendamento"],
    ),
    Servicos: Array.isArray(data.Servicos)
      ? data.Servicos
      : [],
  } as AgendaPublica;
}

export async function obterSlugUsuario(usuarioId: number) {
  const response = await api.get<ApiRecord>(
    `/Usuario/${usuarioId}`,
  );

  return pickString(response.data, ["Slug", "slug"]);
}

// Cache compartilhado por sessão: 0 = catálogo independente de localização.
 // Consultas filtradas por cidade continuam disponíveis em outros fluxos.
const EMPRESAS_CACHE_MS = 3 * 60 * 1000;
const empresasCache = new Map<number, { data: EmpresaCadastro[]; expiresAt: number }>();
const empresasPendentes = new Map<number, Promise<EmpresaCadastro[]>>();

export async function listarEmpresasParaCadastro(
  cidadeId?: number,
): Promise<EmpresaCadastro[]> {
  if (cidadeId !== undefined && (!Number.isInteger(cidadeId) || cidadeId <= 0)) return [];

  const key = cidadeId ?? 0;
  const cached = empresasCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const pending = empresasPendentes.get(key);
  if (pending) return pending;

  const request = (async () => {
    // Sem cidadeId, a API responde com o catálogo público de empresas
    // imediatamente, sem aguardar geolocalização ou seleção de papel.
    const response = cidadeId === undefined
      ? await api.get<ApiRecord[]>("/Profissional/empresas")
      : await api.get<ApiRecord[]>("/Profissional/empresas", { params: { cidadeId } });

    const companies = response.data
      .map((empresa) => ({
        Id: pickNumber(empresa, [
          "IdUsuario", "idUsuario", "Id", "id",
          "UsuarioId", "usuarioId", "EmpresaId", "empresaId",
        ]),
        Nome: pickString(empresa, [
          "NomeFantasia", "nomeFantasia", "Nome", "nome",
        ]),
      }))
      .filter((empresa) => empresa.Id > 0);

    empresasCache.set(key, {
      data: companies,
      expiresAt: Date.now() + EMPRESAS_CACHE_MS,
    });
    return companies;
  })();

  empresasPendentes.set(key, request);
  try {
    return await request;
  } finally {
    if (empresasPendentes.get(key) === request) {
      empresasPendentes.delete(key);
    }
  }
}
