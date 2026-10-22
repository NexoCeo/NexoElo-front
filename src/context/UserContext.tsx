import React, { createContext, useCallback, useContext, useState } from "react";


/** Formatação de exibição para usuários, clientes e profissionais. */
// eslint-disable-next-line react-refresh/only-export-components
export function formatPersonName(value?: string | null): string {
  if (!value) return "";
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR")
    .replace(/(^|[\s'’\-])([\p{L}])/gu, (_, separator: string, initial: string) =>
      separator + initial.toLocaleUpperCase("pt-BR"));
}

// eslint-disable-next-line react-refresh/only-export-components
export function formatEmailDisplay(value?: string | null): string {
  return value?.trim().toLowerCase() ?? "";
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
};

type UserContextType = {
  usuario: Usuario | null;
  setUsuario: (usuario: Usuario | null) => void;
  logout: () => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

const normalizeUsuario = (value: Usuario): Usuario => ({
  ...value,
  Nome: formatPersonName(value.Nome),
  Email: formatEmailDisplay(value.Email),
  Papel: value.Papel?.toUpperCase() ?? "",
});

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
