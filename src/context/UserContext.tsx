import React, { createContext, useCallback, useContext, useState } from "react";


/**
 * Único ponto de formatação para dados de pessoas e empresas vindos da API.
 * Nunca aplica "title case" a valores de negócio, como IDs, URLs, slug,
 * imagens, tokens e senhas.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function formatPersonName(value?: string | null): string {
  if (!value) return "";
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";

  // Preserva grafia intencional de marcas como "NexoCeo", "iFood" e "McDonald".
  // Corrige os casos legados do banco que vêm inteiramente em maiúsculas/minúsculas.
  if (cleaned !== cleaned.toLocaleUpperCase("pt-BR") &&
      cleaned !== cleaned.toLocaleLowerCase("pt-BR")) {
    return cleaned;
  }

  const particles = new Set(["de", "da", "do", "das", "dos", "e"]);
  return cleaned.toLocaleLowerCase("pt-BR")
    .replace(/(^|[\s'’\-])([\p{L}])/gu, (_, separator: string, initial: string) =>
      separator + initial.toLocaleUpperCase("pt-BR"))
    .split(" ")
    .map((word, index) => index > 0 && particles.has(word.toLocaleLowerCase("pt-BR"))
      ? word.toLocaleLowerCase("pt-BR") : word)
    .join(" ");
}

// eslint-disable-next-line react-refresh/only-export-components
export function formatEmailDisplay(value?: string | null): string {
  return value?.trim().toLocaleLowerCase("pt-BR") ?? "";
}

// eslint-disable-next-line react-refresh/only-export-components
export function formatPhoneDisplay(value?: string | null): string {
  const original = value?.trim() ?? "";
  const digits = original.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return original;
}

// eslint-disable-next-line react-refresh/only-export-components
export function formatCnpjDisplay(value?: string | null): string {
  const original = value?.trim() ?? "";
  const normalized = original.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(normalized)) return original;
  return `${normalized.slice(0, 2)}.${normalized.slice(2, 5)}.${normalized.slice(5, 8)}/${normalized.slice(8, 12)}-${normalized.slice(12)}`;
}

// eslint-disable-next-line react-refresh/only-export-components
export function formatUserCode(value?: string | null): string {
  return value?.trim().toUpperCase() ?? "";
}

/**
 * Normaliza campos de usuário em qualquer objeto de resposta (perfil,
 * profissional, cliente, empresa, vínculo) sem modificar campos não relacionados.
 * Valores usados para operações, como IDs, telefones, fotos e URLs, são preservados.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function normalizeUserData<T extends object>(source: T): T {
  const normalized = { ...source } as Record<string, unknown>;
  const nameFields = new Set([
    "Nome", "nome", "Name", "name",
    "NomeFantasia", "nomeFantasia",
    "EmpresaNome", "empresaNome", "ProfissionalNome", "profissionalNome",
    "NomeCliente", "nomeCliente",
  ]);
  const emailFields = new Set([
    "Email", "email", "ProfissionalEmail", "profissionalEmail",
  ]);
  const codeFields = new Set([
    "Papel", "papel", "TipoUsuario", "tipoUsuario",
    "VinculoStatus", "vinculoStatus",
  ]);
  const documentFields = new Set(["Cnpj", "cnpj", "CNPJ"]);

  for (const [key, raw] of Object.entries(normalized)) {
    if (typeof raw !== "string") continue;
    if (nameFields.has(key)) normalized[key] = formatPersonName(raw);
    else if (emailFields.has(key)) normalized[key] = formatEmailDisplay(raw);
    else if (codeFields.has(key)) normalized[key] = formatUserCode(raw);
    else if (documentFields.has(key)) normalized[key] = formatCnpjDisplay(raw);
  }
  return normalized as T;
}

export type Usuario = {
  Id: number;
  Nome: string;
  Email: string;
  Telefone?: string;
  FotoPerfil: string;
  Papel: string;
  Slug: string;
  UrlPublica: string;
  NomeFantasia?: string | null;
  Cnpj?: string | null;
};

type UserContextType = {
  usuario: Usuario | null;
  setUsuario: (usuario: Usuario | null) => void;
  logout: () => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const normalizeUsuario = (value: Usuario): Usuario =>
  normalizeUserData(value);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [usuario, setUsuarioState] = useState<Usuario | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = window.sessionStorage.getItem("usuario");
      return stored ? normalizeUsuario(JSON.parse(stored) as Usuario) : null;
    } catch {
      window.sessionStorage.removeItem("usuario");
      return null;
    }
  });

  const setUsuario = useCallback((novoUsuario: Usuario | null) => {
    if (novoUsuario) {
      const usuarioFormatado = normalizeUsuario(novoUsuario);
      setUsuarioState(usuarioFormatado);
      sessionStorage.setItem("usuario", JSON.stringify(usuarioFormatado));
    } else {
      sessionStorage.removeItem("usuario");
      setUsuarioState(null);
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem("usuario");
    setUsuarioState(null);
  }, []);

  return (
    <UserContext.Provider value={{ usuario, setUsuario, logout }}>
      {children}
    </UserContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser deve ser usado dentro de UserProvider");
  }
  return context;
}
