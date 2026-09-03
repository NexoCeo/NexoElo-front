import api from "./api";
import type {
  CadastroLocalizacaoPayload,
  Coordenadas,
  LocalizacaoResolvida,
} from "@/types/localizacao";

export async function resolverLocalizacao(coordenadas: Coordenadas) {
  const response = await api.post<LocalizacaoResolvida>("/Localizacao/resolver", {
    Latitude: coordenadas.latitude,
    Longitude: coordenadas.longitude,
  });
  return response.data;
}

export function appendCadastroLocalizacao(
  formData: FormData,
  localizacao: CadastroLocalizacaoPayload,
) {
  formData.append("Latitude", String(localizacao.latitude));
  formData.append("Longitude", String(localizacao.longitude));
}
