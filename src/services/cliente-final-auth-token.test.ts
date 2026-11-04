import { beforeEach, describe, expect, it } from "vitest";
import { transferGuestBookingDraft } from "./cliente-final-auth-token";

describe("transferGuestBookingDraft", () => {
  beforeEach(() => sessionStorage.clear());

  const draft = JSON.stringify({
    responsavelId: 18,
    profissionalId: 0,
    servicoId: 2,
    dataSelecionada: "2099-08-20",
    dataAgendamento: "2099-08-20T14:00:00",
    expandedSection: "confirmacao",
  });

  it("mantem a etapa de confirmacao ao voltar do login por slug", () => {
    sessionStorage.setItem("nexoelo-booking-draft:guest:joao-vitor", draft);

    transferGuestBookingDraft("/cliente-final/agendar/joao-vitor", 4);

    expect(sessionStorage.getItem("nexoelo-booking-draft:4:joao-vitor")).toBe(draft);
    expect(sessionStorage.getItem("nexoelo-booking-draft:guest:joao-vitor")).toBeNull();
  });

  it("mantem as escolhas do marketplace e substitui eventual rascunho antigo", () => {
    sessionStorage.setItem("nexoelo-booking-draft:guest:marketplace", draft);
    sessionStorage.setItem("nexoelo-booking-draft:4:marketplace", "rascunho antigo");

    transferGuestBookingDraft("/cliente-final/agendar?origem=agenda", 4);

    expect(sessionStorage.getItem("nexoelo-booking-draft:4:marketplace")).toBe(draft);
    expect(sessionStorage.getItem("nexoelo-booking-draft:guest:marketplace")).toBeNull();
  });

  it("nao altera rascunhos ao entrar em outra pagina", () => {
    sessionStorage.setItem("nexoelo-booking-draft:guest:joao-vitor", draft);

    transferGuestBookingDraft("/cliente-final/home", 4);

    expect(sessionStorage.getItem("nexoelo-booking-draft:guest:joao-vitor")).toBe(draft);
    expect(sessionStorage.getItem("nexoelo-booking-draft:4:joao-vitor")).toBeNull();
  });
});
