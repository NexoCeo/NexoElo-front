import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock("./api", () => ({
  default: { post: mocks.post },
}));

import { migrateLegacyAuthSession } from "./legacy-auth-migration";

describe("legacy authentication migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mocks.post.mockResolvedValue({ status: 204 });
  });

  it("moves sanitized user data to sessionStorage and clears localStorage", async () => {
    localStorage.setItem("accessToken", "legacy-token");
    localStorage.setItem("theme", "dark");
    localStorage.setItem("usuario", JSON.stringify({
      Id: 7,
      Nome: "Empresa",
      Papel: "EMPRESA",
      accessToken: "legacy-token",
      qrCode: "legacy-qr",
    }));

    await migrateLegacyAuthSession();

    expect(mocks.post).toHaveBeenCalledWith("/Auth/MigrarSessao", undefined, {
      headers: { Authorization: "Bearer legacy-token" },
    });
    expect(JSON.parse(sessionStorage.getItem("usuario") || "{}")).toEqual({
      Id: 7,
      Nome: "Empresa",
      Papel: "EMPRESA",
    });
    expect(sessionStorage.getItem("theme")).toBe("dark");
    expect(localStorage.length).toBe(0);
  });
});
