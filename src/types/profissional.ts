export type Profissional = {
  Id: number;
  Nome: string;
  Email: string;
  Telefone: string;
  FotoPerfil?: string;
  TipoUsuario?: string;
  VinculoStatus?: string;
};

export type CreateProfissionalPayload = {
  empresaId: number;
  nome: string;
  email: string;
  telefone: string;
  fotoPerfil: File;
  localizacao: CadastroLocalizacaoPayload;
};

export type AcessoProfissionalCriado = {
  profissional: Profissional;
  senhaTemporaria: string;
};

import type { CadastroLocalizacaoPayload } from "./localizacao";
