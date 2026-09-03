import api from "./api";
import { saveAuthSession } from "./auth-token";

type ApiRecord = Record<string, unknown>;

function pickString(data: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return undefined;
}

function pickObject(data: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as ApiRecord;
    }
  }

  return {};
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

function normalizeUsuario(usuario: ApiRecord) {
  const papel = pickString(usuario, ["Papel", "papel", "TipoUsuario", "tipoUsuario", "role", "Role"]);

  return {
    Id: pickNumber(usuario, ["Id", "id", "UsuarioId", "usuarioId"]),
    Nome: pickString(usuario, ["Nome", "nome", "Name", "name"]) ?? "",
    Email: pickString(usuario, ["Email", "email"]) ?? "",
    Telefone: pickString(usuario, ["Telefone", "telefone"]) ?? "",
    FotoPerfil: pickString(usuario, ["FotoPerfil", "fotoPerfil"]) ?? "",
    Papel: papel?.toUpperCase() ?? "",
    Slug: pickString(usuario, ["Slug", "slug"]) ?? "",
    UrlPublica: pickString(usuario, ["UrlPublica", "urlPublica"]) ?? "",
  };
}

export async function Login(email: string, senha: string) {
  const response = await api.post("/Auth/AutenticarUsuario", {
    email: email.trim(),
    senha,
  });

  const data = response.data as ApiRecord;
  const qrCode = pickString(data, ["qrCode", "QrCode", "QRCode", "qrcode"]);
  const usuario = normalizeUsuario(pickObject(data, ["usuario", "Usuario", "user", "User"]));

  saveAuthSession({ usuario, qrCode });

  return { usuario, qrCode };
}
