import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ServiceImageCrop from "./service-image-crop";

function loadImage(width: number, height: number) {
  const preview = screen.getByRole("img", { name: "Prévia do recorte" }) as HTMLImageElement;
  Object.defineProperties(preview, {
    naturalWidth: { configurable: true, value: width },
    naturalHeight: { configurable: true, value: height },
  });
  fireEvent.load(preview);
  return preview;
}

describe("ServiceImageCrop", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
    });
  });
  afterEach(cleanup);
  afterAll(() => vi.unstubAllGlobals());

  it("restaura a imagem original centralizada quando o zoom volta ao minimo", () => {
    render(
      <ServiceImageCrop
        source="blob:imagem-original"
        filename="imagem.jpg"
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const preview = loadImage(1200, 800);
    const slider = screen.getByRole("slider", { name: "Zoom da imagem" });
    const viewport = screen.getByRole("group", { name: /Área de recorte quadrado/ });

    // O enquadramento inicial ainda amplia a imagem para preencher o quadrado.
    expect(parseFloat(preview.style.width)).toBeCloseTo(525);
    expect(parseFloat(preview.style.height)).toBeCloseTo(350);

    fireEvent.change(slider, { target: { value: "2" } });
    fireEvent.keyDown(viewport, { key: "ArrowRight" });
    expect(preview.style.left).toBe("calc(50% + 10px)");

    fireEvent.change(slider, { target: { value: "1" } });
    expect(preview.style.left).toBe("calc(50% + 0px)");
    expect(preview.style.top).toBe("calc(50% + 0px)");
    expect(parseFloat(preview.style.width)).toBeCloseTo(280);
    expect(parseFloat(preview.style.height)).toBeCloseTo(280 * (800 / 1200));

    // Aumentar novamente parte da mesma foto original, nao do ultimo recorte.
    fireEvent.change(slider, { target: { value: "3" } });
    expect(parseFloat(preview.style.width)).toBeCloseTo(840);
    fireEvent.change(slider, { target: { value: "1" } });
    expect(parseFloat(preview.style.width)).toBeCloseTo(280);
  });

  it("mostra a imagem vertical inteira no zoom minimo", () => {
    render(
      <ServiceImageCrop
        source="blob:foto-vertical"
        filename="foto.jpg"
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const preview = loadImage(800, 1200);
    fireEvent.change(screen.getByRole("slider", { name: "Zoom da imagem" }), {
      target: { value: "1" },
    });

    expect(parseFloat(preview.style.width)).toBeCloseTo(280 * (800 / 1200));
    expect(parseFloat(preview.style.height)).toBeCloseTo(280);
    expect(preview.style.left).toBe("calc(50% + 0px)");
    expect(preview.style.top).toBe("calc(50% + 0px)");
  });
});
