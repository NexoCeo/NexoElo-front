import { useLanguage } from "@/context/LanguageContext";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaPlus,
  FaUser,
} from "react-icons/fa";

import styles from "./style.module.css";
import { EmailInput } from "@/components/auth/emailInput";
import { PasswordInput } from "@/components/auth/passwordInput";
import { InputGeneric } from "@/components/inputGeneric";
import { SubmitButton } from "@/components/auth/submitButton";

import { useTheme } from "@/context/ThemeContext";
import { useRegisterForm } from "@/hooks/useRegisterForm";

function Register() {
  const { t } = useLanguage();
  const { theme } = useTheme();

  const {
    fotoPerfil,
    nome,
    email,
    senha,
    TipoUsuario,

    nomeFantasia,
    cnpj,
    localizacao,



    empresas,
    empresaId,

    loadingEmpresas,
    loading,

    showPassword,

    error,
    emailError,

    setFotoPerfil,
    setNome,
    setEmail,
    setSenha,
    setTipoUsuario,

    setNomeFantasia,
    setCnpj,


    setEmpresaId,

    setShowPassword,

    isFormValid,
    handleSubmit,
  } = useRegisterForm();

  const [previewUrl, setPreviewUrl] = useState("");

  /*
   * Preview da foto de perfil
   */
  useEffect(() => {
    if (!fotoPerfil) {
      setPreviewUrl("");
      return;
    }

    const nextPreviewUrl =
      URL.createObjectURL(fotoPerfil);

    setPreviewUrl(nextPreviewUrl);

    return () =>
      URL.revokeObjectURL(nextPreviewUrl);
  }, [fotoPerfil]);

  return (
    <div
      className={styles.container}
      style={{
        backgroundColor:
          theme.colors.background,
      }}
    >
      <div
        className={`${styles.card} ${TipoUsuario === "empresa" ? styles.compactCard : ""}`}
        style={{
          backgroundColor:
            theme.colors.surface,
        }}
      >
        <form
          onSubmit={handleSubmit}
          className={styles.form}
        >
          {/* Foto de perfil */}
          <div className={styles.formGroup}>
            <div
              className={
                styles.imageUploadContainer
              }
            >
              <input
                type="file"
                accept="image/*"
                id="fotoPerfil"
                className={
                  styles.hiddenFileInput
                }
                onChange={(event) =>
                  setFotoPerfil(
                    event.target.files?.[0] ??
                      null
                  )
                }
              />

              <label
                htmlFor="fotoPerfil"
                className={
                  styles.imageCircle
                }
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Pre-visualizacao"
                    className={
                      styles.imagePreview
                    }
                  />
                ) : (
                  <FaPlus
                    className={
                      styles.plusIcon
                    }
                  />
                )}
              </label>
            </div>
          </div>

          {/* Nome */}
          <div className={styles.formGroup}>
            <label
              className={styles.label}
              style={{
                color: theme.colors.text,
              }}
            >
              {t("auth.name")}
            </label>

            <InputGeneric value={nome} onChange={setNome} name="name" type="text" placeholder={t("auth.enterName")} icon={<FaUser size={15} />} />
          </div>

          {/* Email */}
          <div className={styles.formGroup}>
            <label
              className={styles.label}
              style={{
                color: theme.colors.text,
              }}
            >
              {t("auth.email")}
            </label>

            <EmailInput value={email} onChange={setEmail} />

            {emailError && (
              <p className={styles.error}>
                {emailError}
              </p>
            )}
          </div>

          {/* Senha */}
          <div className={styles.formGroup}>
            <label
              className={styles.label}
              style={{
                color: theme.colors.text,
              }}
            >
              {t("auth.password")}
            </label>

            <PasswordInput value={senha} onChange={setSenha} showPassword={showPassword} togglePassword={() => setShowPassword(!showPassword)} autoComplete="new-password" />
          </div>

          {/* Tipo de usuário */}
          <div className={styles.formGroup}>
            <label
              className={styles.label}
              style={{
                color: theme.colors.text,
              }}
            >
              {t("auth.type")}
            </label>

            <div
              className={
                styles.labelWrapper
              }
            >
              <select
                className={styles.input}
                value={TipoUsuario}
                onChange={(event) =>
                  setTipoUsuario(
                    event.target.value
                  )
                }
                required
              >
                <option value="autonomo" style={{color: theme.colors.text}}>
                  {t("auth.independent")}
                </option>

                <option value="empresa" style={{color: theme.colors.text}}>
                  {t("auth.company")}
                </option>

                <option value="profissional" style={{color: theme.colors.text}}>
                  {t("auth.professional")}
                </option>
              </select>
            </div>
          </div>

          {/* Empresa do profissional */}
          {TipoUsuario ===
            "profissional" && (
            <div
              className={styles.formGroup}
            >
              <label
                className={styles.label}
                style={{
                  color:
                    theme.colors.text,
                }}
              >
                {t("auth.company")}
              </label>

              <div
                className={
                  styles.labelWrapper
                }
              >
                <select
                  className={styles.input}
                  value={empresaId}
                  onChange={(event) =>
                    setEmpresaId(
                      Number(
                        event.target.value
                      )
                    )
                  }
                  disabled={
                    loadingEmpresas ||
                    !localizacao.cidadeId ||
                    empresas.length === 0
                  }
                  required
                >
                  <option value={0}>
                    {loadingEmpresas
                      ? t("auth.loadingCompanies")
                      : empresas.length ===
                          0
                        ? t("auth.noCompanies")
                        : t("auth.chooseCompany")}
                  </option>

                  {empresas.map(
                    (empresa) => (
                      <option
                        key={empresa.Id}
                        value={empresa.Id}
                        style={{color: theme.colors.text}}
                      >
                        {empresa.Nome}
                      </option>
                    )
                  )}
                </select>
              </div>

              {!loadingEmpresas &&
                localizacao.cidadeId > 0 &&
                empresas.length === 0 && (
                  <p
                    className={
                      styles.error
                    }
                  >
                    {t("auth.noCompaniesHere")}
                  </p>
                )}
            </div>
          )}

          {/* Dados específicos de empresa */}
          {TipoUsuario ===
            "empresa" && (
            <>
              {/* Nome fantasia */}
              <div
                className={
                  styles.formGroup
                }
              >
                <label
                  className={
                    styles.label
                  }
                  style={{
                    color:
                      theme.colors.text,
                  }}
                >
                  {t("auth.companyName")}
                </label>

                <InputGeneric type="text" name="nomeFantasia" value={nomeFantasia} onChange={setNomeFantasia} placeholder={t("auth.enterBusinessName")} icon={<FaUser size={15} />} />
              </div>

              {/* CNPJ */}
              <div
                className={
                  styles.formGroup
                }
              >
                <label
                  className={
                    styles.label
                  }
                  style={{
                    color:
                      theme.colors.text,
                  }}
                >
                  CNPJ
                </label>

                <InputGeneric type="text" name="cnpj" value={cnpj} onChange={setCnpj} placeholder={t("auth.enterCnpj")} icon={<FaUser size={15} />}                />
              </div>
            </>
          )}

          {/* Erro geral */}
          {error && (
            <p className={styles.error}>
              {error}
            </p>
          )}

          {/* Link login */}
          <div
            className={styles.linksRow}
          >
            <Link
              to="/global/login"
              className={styles.link}
              style={{
                color:
                  theme.colors.primary,
              }}
            >
              {t("auth.haveAccount")}
            </Link>
          </div>

          {/* Botão cadastrar */}
          <SubmitButton disabled={!isFormValid() || loadingEmpresas} loading={loading}>{t("auth.register")}</SubmitButton>
        </form>
      </div>
    </div>
  );
}

export default Register;
