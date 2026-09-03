export type Coordenadas = {
  latitude: number;
  longitude: number;
};

export type LocalizacaoResolvida = {
  PaisId: number;
  PaisNome: string;
  EstadoId: number;
  EstadoNome: string;
  CidadeId: number;
  CidadeNome: string;
};

export type CadastroLocalizacaoPayload = Coordenadas;
