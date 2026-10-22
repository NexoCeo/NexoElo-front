import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/context/LanguageContext";
const mocks = vi.hoisted(() => ({ history: vi.fn(), notify: vi.fn() }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: mocks.notify }) }));
vi.mock("@/services/agendamento-service", () => ({ listarHistoricoAgendamentos: mocks.history, atualizarStatusAgendamento: vi.fn() }));
vi.mock("@/services/cliente-final-auth-token", () => ({ getClienteFinalUser: () => ({ Id: 4, Nome: "Cliente", TipoUsuario: "CLIENTE" }) }));
vi.mock("@/services/agenda-realtime-service", () => ({ createAgendaRealtimeClient: () => ({ start: vi.fn(), stop: vi.fn().mockResolvedValue(undefined) }) }));
import Home from "./index";
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "languages", { configurable: true, value: ["pt-BR"] });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
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
  await screen.findByText("Aguardando conexão para atualizar seus agendamentos automaticamente.");
  expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
  expect(mocks.notify).not.toHaveBeenCalled();
  fireEvent(window, new Event("online"));
  expect(await screen.findByText("Nenhum atendimento agendado")).toBeInTheDocument();
});

it("consulta automaticamente e remove os listeners ao desmontar", async () => {
  mocks.history.mockResolvedValue([]);
  const view = render(<MemoryRouter><LanguageProvider><Home /></LanguageProvider></MemoryRouter>);
  await screen.findByText("Nenhum atendimento agendado");
  fireEvent.click(screen.getByRole("tab", { name: "Histórico" }));
  expect(screen.queryByRole("button", { name: "Atualizar" })).not.toBeInTheDocument();
  vi.useFakeTimers();
  fireEvent(window, new Event("focus"));
  await act(async () => {});
  expect(mocks.history).toHaveBeenCalledTimes(2);
  view.unmount();
  fireEvent(window, new Event("focus"));
  await act(async () => { vi.advanceTimersByTime(30000); });
  expect(mocks.history).toHaveBeenCalledTimes(2);
});
it("reconsulta a cada 15 segundos sem mostrar carregamento", async () => {
  vi.useFakeTimers();
  mocks.history.mockResolvedValue([]);
  mount();
  await act(async () => {});
  expect(mocks.history).toHaveBeenCalledTimes(1);
  await act(async () => { vi.advanceTimersByTime(15000); });
  expect(mocks.history).toHaveBeenCalledTimes(2);
  expect(screen.getByText("Nenhum atendimento agendado")).toBeInTheDocument();
});
