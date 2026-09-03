import { describe, expect, it } from "vitest";
import api from "./api";

describe("api", () => {
  it("usa rotas same-origin para preservar a sessao no Safari", () => {
    expect(api.defaults.baseURL).toBe("/api/");
    expect(api.defaults.withCredentials).toBe(true);
    expect(api.defaults.timeout).toBe(20_000);
  });
});
