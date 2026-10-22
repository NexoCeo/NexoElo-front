import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/context/LanguageContext";
const mocks = vi.hoisted(() => ({ history: vi.fn(), notify: vi.fn() }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: mocks.notify }) }));
vi.mock("@/services/agendamento-service", () => ({ listarHistoricoAgendamentos: mocks.history, atualizarStatusAgendamento: vi.fn() }));
vi.mock("@/services/cliente-final-auth-token", () => ({ getClienteFinalUser: () => ({ Id: 4, Nome: "Cliente", TipoUsuario: "CLIENTE" }) }));
import Home from "./index";
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "languages", { configurable: true, value: ["pt-BR"] });
});
afterEach(cleanup);
function mount() { render(<MemoryRouter><LanguageProvider><Home /></LanguageProvider></MemoryRouter>); }
it("mostra estado vazio sem alerta quando nao ha agendamentos", async () => {
  mocks.history.mockResolvedValue([]);
  mount();
  expect(await screen.findByText("Nenhum atendimento agendado")).toBeInTheDocument();
  expect(mocks.notify).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("tab", { name: "Histórico" }));
  expect(screen.getByText("Seu histórico está vazio")).toBeInTheDocument();
});
it("mantem tentativa de consulta sem toast vermelho quando a API falha", async () => {
  mocks.history.mockRejectedValueOnce(new Error("network")).mockResolvedValue([]);
  mount();
  const retry = await screen.findByRole("button", { name: "Tentar novamente" });
  expect(mocks.notify).not.toHaveBeenCalled();
  fireEvent.click(retry);
  expect(await screen.findByText("Nenhum atendimento agendado")).toBeInTheDocument();
});
