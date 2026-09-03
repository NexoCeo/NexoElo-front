import type { Usuario } from "@/context/UserContext";
import api from "./api";

type ApiRecord = Record<string, unknown>;

export type UpdatePerfilPayload = {
  Nome: string;
  Email: string;
  Telefone?: string;
  FotoPerfil?: File | null;
};

function pickString(data: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string") {
      return value;
    }
  }

  return "";
}

function pickNumber(data: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function normalizeUsuario(data: ApiRecord): Usuario {
  return {
    Id: pickNumber(data, ["Id", "id"]),
    Nome: pickString(data, ["Nome", "nome"]),
    Email: pickString(data, ["Email", "email"]),
    Telefone: pickString(data, ["Telefone", "telefone"]),
    FotoPerfil: pickString(data, ["FotoPerfil", "fotoPerfil"]),
    Papel: pickString(data, ["Papel", "papel", "TipoUsuario", "tipoUsuario"]).toUpperCase(),
    Slug: pickString(data, ["Slug", "slug"]),
    UrlPublica: pickString(data, ["UrlPublica", "urlPublica"]),
  };
}

export async function obterPerfilUsuario(id: number) {
  const response = await api.get<ApiRecord>(`/Usuario/${id}`);
  return normalizeUsuario(response.data);
}

export async function atualizarPerfilUsuario(id: number, payload: UpdatePerfilPayload) {
  const formData = new FormData();
  formData.append("Nome", payload.Nome);
  formData.append("Email", payload.Email);
  formData.append("Telefone", payload.Telefone ?? "");

  if (payload.FotoPerfil) {
    formData.append("FotoPerfil", payload.FotoPerfil);
  }

  const response = await api.put<ApiRecord>(`/Usuario/${id}/perfil`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return normalizeUsuario(response.data);
}
