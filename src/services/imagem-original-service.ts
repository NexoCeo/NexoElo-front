import { isAxiosError } from "axios";
import api from "./api";

// Busca a imagem integral via endpoint autorizado, nunca pela URL publica do recorte.
export async function carregarImagemOriginal(endpoint: string): Promise<File | null> {
  try {
    const { data } = await api.get<Blob>(endpoint, { responseType: "blob" });
    const mimeType = data.type || "image/jpeg";
    const extension = mimeType === "image/png" ? "png"
      : mimeType === "image/webp" ? "webp" : "jpg";
    return new File([data], `imagem-original.${extension}`, { type: mimeType });
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}
