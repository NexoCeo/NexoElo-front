import api from "./api";
import type {
  CreateServicoPayload,
  Servico,
  UpdateServicoPayload,
} from "@/types/servico";

function normalizeServico(servico: Partial<Servico>): Servico {
  return {
    Id: Number(servico.Id ?? 0),
    UsuarioFk: servico.UsuarioFk ?? null,
    ProfissionalId: servico.ProfissionalId ?? null,
    EmpresaId: servico.EmpresaId ?? null,
    NomeServico: servico.NomeServico ?? "",
    Valor: Number(servico.Valor ?? 0),
    TempoEstimadoMinutos: Number(servico.TempoEstimadoMinutos ?? 0),
    ImagemServico: servico.ImagemServico ?? "",
  };
}

export async function listarServicosPorEmpresa(id: number) {
  const response = await api.get<Servico[]>("/Servico/ListarServicosPorEmpresa", {
    params: { id },
  });

  return Array.isArray(response.data) ? response.data.map(normalizeServico) : [];
}

export async function listarServicosPorProfissional(profissionalId: number, empresaId: number) {
  const response = await api.get<Servico[]>(
    `/Vinculos/profissionais/${profissionalId}/empresa/${empresaId}/servicos`,
  );

  return Array.isArray(response.data) ? response.data.map(normalizeServico) : [];
}

export async function salvarServicosDoProfissional(
  profissionalId: number,
  empresaId: number,
  servicoIds: number[],
) {
  const response = await api.put<Servico[]>(
    `/Vinculos/profissionais/${profissionalId}/empresa/${empresaId}/servicos`,
    { ServicoIds: servicoIds },
  );

  return Array.isArray(response.data) ? response.data.map(normalizeServico) : [];
}

export async function inserirServico(payload: CreateServicoPayload) {
  const formData = new FormData();
  formData.append("NomeServico", payload.NomeServico);
  formData.append("Valor", String(payload.Valor));
  formData.append("TempoEstimadoMinutos", String(payload.TempoEstimadoMinutos));

  if (payload.ImagemServico) {
    formData.append("ImagemServico", payload.ImagemServico);
  }

  const response = await api.post<Servico>("/Servico/InserirServicoComImagem", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return normalizeServico(response.data);
}

export async function atualizarServico(id: number, payload: UpdateServicoPayload) {
  const formData = new FormData();
  formData.append("NomeServico", payload.NomeServico);
  formData.append("Valor", String(payload.Valor));
  formData.append("TempoEstimadoMinutos", String(payload.TempoEstimadoMinutos));

  if (payload.ImagemServico) {
    formData.append("ImagemServico", payload.ImagemServico);
  }

  const response = await api.put<Servico>(`/Servico/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return normalizeServico(response.data);
}
