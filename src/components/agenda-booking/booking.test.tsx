import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/context/LanguageContext";
import AgendaBooking from "./index";

const mocks = vi.hoisted(() => ({
  user: { Id: 7, Papel: "AUTONOMO" },
  clients: vi.fn(), slots: vi.fn(), create: vi.fn(), services: vi.fn(), professionals: vi.fn(), link: vi.fn(),
}));
vi.mock("@/context/UserContext", () => ({ useUser: () => ({ usuario: mocks.user }) }));
vi.mock("@/services/agendamento-service", () => ({
  formatAgendaDateParam: (date: Date) => date.toISOString().slice(0, 10),
  listarClientesAgendamento: mocks.clients, listarHorariosDisponiveis: mocks.slots,
  criarAgendamento: mocks.create, listarProfissionaisAgendamento: mocks.professionals,
}));
vi.mock("@/services/servico-service", () => ({
  listarServicosPorEmpresa: mocks.services, listarServicosPorProfissional: mocks.services,
}));
vi.mock("@/services/vinculo-service", () => ({ obterStatusVinculoProfissional: mocks.link }));
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "languages", { configurable: true, value: ["pt-BR"] });
  mocks.user = { Id: 7, Papel: "AUTONOMO" };
  mocks.clients.mockResolvedValue([{ Id: 4, Nome: "Maria" }]);
  mocks.services.mockResolvedValue([{ Id: 2, NomeServico: "Corte", TempoEstimadoMinutos: 30 }]);
  mocks.slots.mockResolvedValue([{ DataAgendamento: "2099-10-23T10:00:00", Horario: "10:00" }]);
  mocks.create.mockResolvedValue({});
});
afterEach(cleanup);
const mount = (onCreated = vi.fn()) => render(<LanguageProvider><AgendaBooking date={new Date("2099-10-23T12:00:00")} professionalId={0} onClose={vi.fn()} onCreated={onCreated} /></LanguageProvider>);
async function selectBooking() {
  await screen.findByRole("option", { name: "Maria" });
  await screen.findByRole("option", { name: /Corte/ });
  fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "4" } });
  fireEvent.change(screen.getByLabelText("Serviço"), { target: { value: "2" } });
  await screen.findByRole("option", { name: "10:00" });
  fireEvent.change(screen.getByLabelText("Horários disponíveis"), { target: { value: "2099-10-23T10:00:00" } });
}
it("agenda usando o autonomo logado e o cliente selecionado", async () => {
  const created = vi.fn(); mount(created); await selectBooking();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));
  await waitFor(() => expect(created).toHaveBeenCalledWith("2099-10-23"));
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ ClienteId: 4, ResponsavelId: 7, ServicoId: 2 }));
});
it("resolve automaticamente empresa e identidade do profissional", async () => {
  mocks.user = { Id: 9, Papel: "PROFISSIONAL" };
  mocks.link.mockResolvedValue({ status: "APROVADO", empresaId: 7 });
  mount(); await selectBooking();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ ResponsavelId: 7, ProfissionalId: 9 })));
});
it("limpa a selecao e atualiza os horarios apos conflito", async () => {
  mocks.create.mockRejectedValue(new Error("conflict"));
  const created = vi.fn(); mount(created); await selectBooking();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));
  await screen.findByRole("alert");
  await waitFor(() => expect(mocks.slots).toHaveBeenCalledTimes(2));
  expect(created).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Confirmar agendamento" })).toBeDisabled();
});

it("exibe o formulario completo imediatamente enquanto busca os dados", () => {
  mocks.clients.mockReturnValue(new Promise(() => {}));
  mount();
  expect(screen.getByLabelText("Cliente")).toBeInTheDocument();
  expect(screen.getByLabelText("Serviço")).toBeInTheDocument();
  expect(screen.getByLabelText("Data")).toBeInTheDocument();
  expect(screen.getByLabelText("Horários disponíveis")).toBeInTheDocument();
  expect(screen.queryByText("Carregando...")).not.toBeInTheDocument();
  expect(screen.queryByText("Nenhum cliente cadastrado.")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Confirmar agendamento" })).toBeDisabled();
});
