import api from "./api";
import { saveClienteFinalSession } from "./cliente-final-auth-token";
import { appendCadastroLocalizacao } from "./localizacao-service";
import type {
  ClienteFinal,
  ClienteFinalLoginPayload,
  ClienteFinalRegisterPayload,
} from "@/types/cliente-final";

type ApiRecord = Record<string, unknown>;

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[1-9]{2}9\d{8}$/;

export function normalizeClienteFinalLogin(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue.includes("@")
    ? trimmedValue.toLowerCase()
    : onlyDigits(trimmedValue);
}

export function isValidClienteFinalLogin(value: string) {
  const normalizedLogin = normalizeClienteFinalLogin(value);
  return EMAIL_PATTERN.test(normalizedLogin) || PHONE_PATTERN.test(normalizedLogin);
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

function normalizeClienteFinal(data: ApiRecord): ClienteFinal {
  const cliente = pickObject(data, ["usuario", "Usuario", "cliente", "Cliente", "clienteFinal", "ClienteFinal", "user", "User"]);
  const tipoUsuario = pickString(cliente, ["TipoUsuario", "tipoUsuario", "Papel", "papel"]).toUpperCase();

  return {
    Id: pickNumber(cliente, ["Id", "id", "ClienteId", "clienteId"]),
    Nome: pickString(cliente, ["Nome", "nome", "NomeCliente", "nomeCliente", "Name", "name"]),
    Email: pickString(cliente, ["Email", "email"]),
    Telefone: pickString(cliente, ["Telefone", "telefone", "TelefoneCliente", "telefoneCliente"]),
    TipoUsuario: tipoUsuario,
  };
}

export async function loginClienteFinal({ login, senha }: ClienteFinalLoginPayload) {
  const normalizedLogin = normalizeClienteFinalLogin(login);

  if (!isValidClienteFinalLogin(normalizedLogin)) {
    throw new Error("Informe um e-mail ou telefone valido.");
  }

  const response = await api.post<ApiRecord>("/Auth/AutenticarUsuario", {
    Login: normalizedLogin,
    Senha: senha,
  });

  const cliente = normalizeClienteFinal(response.data);

  if (cliente.TipoUsuario !== "CLIENTE") {
    throw new Error("Use o e-mail ou telefone cadastrado para entrar como cliente.");
  }

  const clienteLogin = normalizedLogin.includes("@")
    ? cliente.Email.trim().toLowerCase()
    : onlyDigits(cliente.Telefone);

  if (clienteLogin !== normalizedLogin) {
    throw new Error("A API retornou um usuario diferente do identificador informado.");
  }

  saveClienteFinalSession(cliente);

  return { cliente };
}

export async function registerClienteFinal({
  nome,
  email,
  telefone,
  senha,
  fotoPerfil,
  localizacao,
}: ClienteFinalRegisterPayload) {
  const nomeNormalizado = nome.trim();
  const formData = new FormData();

  formData.append("Nome", nomeNormalizado);
  formData.append("Email", email.trim());
  formData.append("Telefone", onlyDigits(telefone));
  formData.append("Senha", senha);
  formData.append("TipoUsuario", "CLIENTE");
  appendCadastroLocalizacao(formData, localizacao);
  formData.append("Slug", nomeNormalizado.toLowerCase().replace(/\s+/g, "-"));
  formData.append("FotoPerfil", fotoPerfil);

  const response = await api.post<ApiRecord>("/Usuario/InserirUsuario", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data;
}
