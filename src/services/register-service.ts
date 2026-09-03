import api from "./api";
import { appendCadastroLocalizacao } from "./localizacao-service";
import type { CadastroLocalizacaoPayload } from "@/types/localizacao";

export async function Register(
  fotoPerfil: File | null,
  nome: string,
  email: string,
  senha: string,
  tipo: "AUTONOMO" | "EMPRESA" | "PROFISSIONAL",
  localizacao: CadastroLocalizacaoPayload,
  nomeFantasia?: string,
  cnpj?: string,
  empresaId?: number,
) {
  const formData = new FormData();

  formData.append("Nome", nome);
  formData.append("Email", email.trim());
  formData.append("Senha", senha);
  formData.append("TipoUsuario", tipo);
  formData.append("Slug", nome.toLowerCase().replace(/\s+/g, "-"));
  appendCadastroLocalizacao(formData, localizacao);

  if (tipo === "EMPRESA") {
    if (nomeFantasia) {
      formData.append("NomeFantasia", nomeFantasia);
    }

    if (cnpj) {
      formData.append("Cnpj", cnpj);
    }
  }

  if (tipo === "PROFISSIONAL") {
    if (!empresaId || empresaId <= 0) {
      throw new Error("Empresa invalida para o profissional.");
    }

    formData.append("EmpresaId", String(empresaId));
  }

  if (fotoPerfil) {
    formData.append("FotoPerfil", fotoPerfil);
  }

  const response = await api.post(
    "/Usuario/InserirUsuario",
    formData,
  );

  return response.data;
}
