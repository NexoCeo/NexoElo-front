import { describe, expect, it } from "vitest";
import api, { API_ORIGIN } from "./api";

describe("api", () => {
  it("usa a origem centralizada da API", () => {
    expect(API_ORIGIN).toBe(
      "https://nexoelo.onrender.com",
    );

    expect(api.defaults.baseURL).toBe(
      `${API_ORIGIN}/api/`,
    );

    expect(api.defaults.withCredentials).toBe(true);
    expect(api.defaults.timeout).toBe(20_000);
  });
});
