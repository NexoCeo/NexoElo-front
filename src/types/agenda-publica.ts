import type { Servico } from "./servico";

export type AgendaPublica = {
  UsuarioId: number;
  Nome: string;
  TipoUsuario: string;
  Slug: string;
  FotoPerfil?: string;
  UrlAgendamento: string;
  Servicos: Servico[];
};
