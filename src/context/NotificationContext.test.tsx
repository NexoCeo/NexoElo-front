import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NotificationProvider, useNotification } from "./NotificationContext";

function NotificationHarness() {
  const { showNotification } = useNotification();

  return (
    <div>
      <button
        type="button"
        onClick={() => showNotification({
          type: "success",
          title: "Alteracao salva",
          message: "Os dados foram atualizados.",
        })}
      >
        Sucesso
      </button>
      <button
        type="button"
        onClick={() => showNotification({
          type: "warning",
          title: "Revise os dados",
          message: "Existe um campo pendente.",
        })}
      >
        Aviso
      </button>
      <button
        type="button"
        onClick={() => showNotification({
          type: "error",
          title: "Operacao nao concluida",
          message: "Tente novamente.",
        })}
      >
        Erro
      </button>
    </div>
  );
}

describe("NotificationProvider", () => {
  it("exibe sucesso, aviso e erro sem duplicar uma notificacao ativa", () => {
    render(
      <NotificationProvider>
        <NotificationHarness />
      </NotificationProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sucesso" }));
    fireEvent.click(screen.getByRole("button", { name: "Sucesso" }));
    fireEvent.click(screen.getByRole("button", { name: "Aviso" }));
    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(screen.getAllByText("Alteracao salva")).toHaveLength(1);
    expect(screen.getByText("Revise os dados")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Operacao nao concluida");
    expect(screen.getAllByRole("status")).toHaveLength(2);
  });
});
