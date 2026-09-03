import React, { createContext, useCallback, useContext, useState, useEffect } from "react";

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

const capitalizeName = (nome: string) => {
  if (!nome) {
    return "";
  }

  return nome
    .toLowerCase()
    .split(" ")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
};

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [usuario, setUsuarioState] = useState<Usuario | null>(null);

  useEffect(() => {
    const usuarioStr = sessionStorage.getItem("usuario");
    if (!usuarioStr) return;

    try {
      setUsuarioState(JSON.parse(usuarioStr));
    } catch {
      sessionStorage.removeItem("usuario");
    }
  }, []);

  const setUsuario = useCallback((novoUsuario: Usuario | null) => {
    if (novoUsuario) {
      const usuarioFormatado = {
        ...novoUsuario,
        Nome: capitalizeName(novoUsuario.Nome),
        Email: novoUsuario.Email?.toLowerCase() ?? "",
        Papel: novoUsuario.Papel?.toUpperCase() ?? "",
      };
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
