import api from "./api";
import { appendCadastroLocalizacao } from "./localizacao-service";
import type {
  AcessoProfissionalCriado,
  CreateProfissionalPayload,
  Profissional,
} from "@/types/profissional";

type ApiRecord = Record<string, unknown>;

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

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

function pickObject(data: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as ApiRecord;
    }
  }

  return data;
}

function extractList(data: unknown) {
  if (Array.isArray(data)) {
    return data as ApiRecord[];
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  const record = data as ApiRecord;
  const possibleKeys = ["profissionais", "Profissionais", "data", "Data", "items", "Items"];

  for (const key of possibleKeys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value as ApiRecord[];
    }
  }

  return [];
}

function normalizeProfissional(data: ApiRecord): Profissional {
  const profissional = pickObject(data, [
    "profissional",
    "Profissional",
    "usuario",
    "Usuario",
    "user",
    "User",
  ]);

  return {
    Id: pickNumber(profissional, ["Id", "id", "UsuarioId", "usuarioId", "ProfissionalId", "profissionalId"])
      || pickNumber(data, ["ProfissionalId", "profissionalId", "UsuarioId", "usuarioId"]),
    Nome: pickString(profissional, ["Nome", "nome", "Name", "name"]),
    Email: pickString(profissional, ["Email", "email"]),
    Telefone: pickString(profissional, ["Telefone", "telefone"]),
    FotoPerfil: pickString(profissional, ["FotoPerfil", "fotoPerfil"]),
    TipoUsuario: pickString(profissional, ["TipoUsuario", "tipoUsuario", "Papel", "papel"]).toUpperCase(),
    VinculoStatus: pickString(data, ["VinculoStatus", "vinculoStatus", "Status", "status"]),
  };
}

export async function listarProfissionaisEmpresa(empresaId: number) {
  const response = await api.get<unknown>(`/Vinculos/profissionais/empresa/${empresaId}`);
  return extractList(response.data)
    .map(normalizeProfissional)
    .filter((profissional) => profissional.Id || profissional.Nome || profissional.Email);
}

export async function criarProfissionalEmpresa(
  payload: CreateProfissionalPayload,
): Promise<AcessoProfissionalCriado> {
  const formData = new FormData();
  const nomeNormalizado = payload.nome.trim();

  formData.append("Nome", nomeNormalizado);
  formData.append("Email", payload.email.trim());
  formData.append("Telefone", onlyDigits(payload.telefone));
  formData.append("TipoUsuario", "PROFISSIONAL");
  appendCadastroLocalizacao(formData, payload.localizacao);
  formData.append("EmpresaId", String(payload.empresaId));
  formData.append("FotoPerfil", payload.fotoPerfil);

  const response = await api.post<ApiRecord>("/Usuario/InserirUsuario", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return {
    profissional: normalizeProfissional(response.data),
    senhaTemporaria: pickString(response.data, ["senhaTemporaria", "SenhaTemporaria"]),
  };
}
