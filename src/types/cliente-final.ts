export type ClienteFinal = {
  Id: number;
  Nome: string;
  Email: string;
  Telefone: string;
  TipoUsuario: string;
};

export type ClienteFinalLoginPayload = {
  login: string;
  senha: string;
};

export type ClienteFinalRegisterPayload = {
  nome: string;
  email: string;
  telefone: string;
  senha: string;
  fotoPerfil: File;
  localizacao: CadastroLocalizacaoPayload;
};

import type { CadastroLocalizacaoPayload } from "./localizacao";
