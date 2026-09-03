import defaultProfileImg from "@/assets/imagemDefault.png";
import api from "@/services/api";

export { defaultProfileImg };

export function getUploadedImageUrl(imagePath?: string | null) {
  const normalizedImagePath = imagePath?.trim();

  if (
    !normalizedImagePath ||
    normalizedImagePath.replace(/^\/?(uploads\/)?/i, "").toUpperCase() === "SEM_FOTO"
  ) {
    return "";
  }

  if (/^https?:\/\//i.test(normalizedImagePath)) {
    return normalizedImagePath;
  }

  const apiOrigin = api.defaults.baseURL?.replace(/\/api\/?$/, "") ?? "";
  const cleanBaseUrl = apiOrigin.replace(/\/$/, "");
  const cleanFilePath = normalizedImagePath.replace(/^\/?(uploads\/)?/i, "");

  return `${cleanBaseUrl}/uploads/${cleanFilePath}`;
}

export function getProfileImageUrl(fotoPerfil?: string | null) {
  return getUploadedImageUrl(fotoPerfil) || defaultProfileImg;
}
