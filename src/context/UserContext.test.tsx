import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import {
  formatCnpjDisplay,
  formatEmailDisplay,
  formatPersonName,
  formatPhoneDisplay,
  formatUserCode,
  normalizeUserData,
  normalizeUsuario,
  useUser,
  UserProvider,
} from "./UserContext";

describe("UserContext - regras globais de formatação dos dados do banco", () => {
  beforeEach(() => window.sessionStorage.removeItem("usuario"));

  it("normaliza nomes totalmente maiúsculos e e-mails, preservando nomes de marca", () => {
    expect(formatPersonName("FELIPE COSTA")).toBe("Felipe Costa");
    expect(formatPersonName("BARBEARIA DO PEDRO")).toBe("Barbearia do Pedro");
    expect(formatPersonName("BARBEARIA TESTE LTDA")).toBe("Barbearia Teste Ltda");
    expect(formatPersonName("Barbearia Shop")).toBe("Barbearia Shop");
    expect(formatPersonName("NexoCeo")).toBe("NexoCeo");
    expect(formatPersonName("  joão   vitor  ")).toBe("João Vitor");
    expect(formatEmailDisplay(" FELIPETESTE@GMAIL.COM ")).toBe("felipeteste@gmail.com");
  });

  it("formata documentos e telefones apenas para exibição, preservando códigos técnicos", () => {
    expect(formatPhoneDisplay("27999999999")).toBe("(27) 99999-9999");
    expect(formatPhoneDisplay("2733334444")).toBe("(27) 3333-4444");
    expect(formatCnpjDisplay("27019954000100")).toBe("27.019.954/0001-00");
    expect(formatCnpjDisplay("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
    expect(formatUserCode(" profissional ")).toBe("PROFISSIONAL");
    expect(normalizeUserData({
      Id: 42,
      Nome: "FELIPE COSTA",
      Email: "FELIPE@TESTE.COM",
      Telefone: "27999999999",
      FotoPerfil: "/uploads/ORIGINAL.webp",
      Slug: "NexoCeo-Pro",
      UrlPublica: "https://exemplo.com/LinkA",
      VinculoStatus: "aprovado",
      Token: "aBc123",
    })).toEqual({
      Id: 42,
      Nome: "Felipe Costa",
      Email: "felipe@teste.com",
      Telefone: "27999999999",
      FotoPerfil: "/uploads/ORIGINAL.webp",
      Slug: "NexoCeo-Pro",
      UrlPublica: "https://exemplo.com/LinkA",
      VinculoStatus: "APROVADO",
      Token: "aBc123",
    });
  });

  it("normaliza o usuário recebido e também a sessão restaurada", () => {
    const backendUser = {
      Id: 7,
      Nome: "BARBEARIA SHOP LTDA",
      Email: "BARBEARIATESTE@GMAIL.COM",
      Telefone: "27999999999",
      FotoPerfil: "SEM_FOTO",
      Papel: "empresa",
      Slug: "BarbeariaShop",
      UrlPublica: "",
      NomeFantasia: "BARBEARIA DO PEDRO",
      Cnpj: "27019954000100",
    };

    expect(normalizeUsuario(backendUser)).toMatchObject({
      Nome: "Barbearia Shop Ltda",
      Email: "barbeariateste@gmail.com",
      NomeFantasia: "Barbearia do Pedro",
      Cnpj: "27.019.954/0001-00",
      Papel: "EMPRESA",
    });

    window.sessionStorage.setItem("usuario", JSON.stringify(backendUser));
    const wrapper = ({ children }: { children: ReactNode }) =>
      <UserProvider>{children}</UserProvider>;
    const { result } = renderHook(() => useUser(), { wrapper });
    expect(result.current.usuario?.Nome).toBe("Barbearia Shop Ltda");
    expect(result.current.usuario?.NomeFantasia).toBe("Barbearia do Pedro");

    act(() => result.current.setUsuario({
      ...backendUser,
      Nome: "FELIPE COSTA",
      Email: "FELIPE@EXEMPLO.COM",
    }));
    expect(result.current.usuario?.Nome).toBe("Felipe Costa");
    expect(result.current.usuario?.Email).toBe("felipe@exemplo.com");
    expect(JSON.parse(window.sessionStorage.getItem("usuario")!).Nome).toBe("Felipe Costa");
  });
});
