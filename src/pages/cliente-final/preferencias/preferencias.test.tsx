import { fireEvent, screen, waitFor } from "@testing-library/react";
import { render as renderWithNotifications } from "@/test/render-with-notifications";
import { LanguageProvider } from "@/context/LanguageContext";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listarHistoricoAgendamentos: vi.fn(),
}));

vi.mock("@/services/agendamento-service", () => ({
  listarHistoricoAgendamentos: mocks.listarHistoricoAgendamentos,
}));
vi.mock("@/services/cliente-final-auth-token", () => ({
  getClienteFinalUser: () => ({
    Id: 4, Nome: "VITOR CLIENTE", Email: "vitor@example.com", TipoUsuario: "CLIENTE",
  }),
}));

import ClienteFinalPreferencias from "./index";

function ReturnProbe() {
  const location = useLocation();
  return (
    <output data-testid="return-location">
      {location.pathname}:{(location.state as { section?: string } | null)?.section ?? ""}
    </output>
  );
}

describe("ClienteFinalPreferencias", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      value: ["pt-BR"],
    });
    vi.clearAllMocks();
    localStorage.clear();
    mocks.listarHistoricoAgendamentos.mockResolvedValue([
      {
        Id: 12, ClienteId: 4, ServicoId: 1,
        DataAgendamento: "2099-01-01T10:00:00",
        Valor: 50, ValorServico: 50, Taxa: 0, Status: "AGENDADO",
        ClienteNome: "Vitor Cliente",
        ServicoNome: "Corte",
        ProfissionalNome: "Maria Eduarda",
      },
    ]);
  });

  it("permite salvar favoritos em uma página e voltar diretamente ao perfil", async () => {
    renderWithNotifications(
      <LanguageProvider>
        <MemoryRouter initialEntries={["/cliente-final/preferencias"]}>
          <Routes>
            <Route path="/cliente-final/preferencias" element={<ClienteFinalPreferencias />} />
            <Route path="/cliente-final/home" element={<ReturnProbe />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>,
    );

    expect(screen.getByRole("heading", { name: "Minhas preferências" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Profissional favorito" })).not.toBeDisabled());

    fireEvent.change(screen.getByRole("combobox", { name: "Profissional favorito" }), {
      target: { value: "Maria Eduarda" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Serviço favorito" }), {
      target: { value: "Corte" },
    });
    expect(JSON.parse(localStorage.getItem("nexoelo-client-preferences:4") || "{}")).toEqual({
      favoriteProfessional: "Maria Eduarda",
      favoriteService: "Corte",
    });
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao perfil" }));
    expect(screen.getByTestId("return-location")).toHaveTextContent("/cliente-final/home:perfil");
  });
});
