import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaPlus,
  FaUser,
} from "react-icons/fa";

import styles from "./style.module.css";

import { useTheme } from "@/context/ThemeContext";
import { useRegisterForm } from "@/hooks/useRegisterForm";

function Register() {
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

  /*
   * Tema dos inputs
   */
  const inputTheme = {
    backgroundColor: theme.colors.bottom,
    color: theme.colors.inactive,
  };

  return (
    <div
      className={styles.container}
      style={{
        backgroundColor:
          theme.colors.background,
      }}
    >
      <div
        className={styles.card}
        style={{
          backgroundColor:
            theme.colors.bottom,
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
              Nome
            </label>

            <div
              className={
                styles.labelWrapper
              }
            >
              <input
                type="text"
                className={styles.input}
                style={inputTheme}
                value={nome}
                onChange={(event) =>
                  setNome(event.target.value)
                }
                placeholder="Digite seu nome"
                required
              />

              <span
                className={styles.icon}
              >
                <FaUser size={20} />
              </span>
            </div>
          </div>

          {/* Email */}
          <div className={styles.formGroup}>
            <label
              className={styles.label}
              style={{
                color: theme.colors.text,
              }}
            >
              Email
            </label>

            <div
              className={
                styles.labelWrapper
              }
            >
              <input
                type="email"
                className={styles.input}
                style={inputTheme}
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="Digite seu e-mail"
                required
              />

              <span
                className={styles.icon}
              >
                <FaEnvelope size={20} />
              </span>
            </div>

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
              Senha
            </label>

            <div
              className={
                styles.labelWrapper
              }
            >
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                className={styles.input}
                style={inputTheme}
                value={senha}
                onChange={(event) =>
                  setSenha(event.target.value)
                }
                placeholder="Digite sua senha"
                required
              />

              <button
                type="button"
                className={
                  styles.iconButton
                }
                onClick={() =>
                  setShowPassword(
                    !showPassword
                  )
                }
                aria-label="Alternar visibilidade da senha"
              >
                {showPassword ? (
                  <FaEyeSlash size={20} />
                ) : (
                  <FaEye size={20} />
                )}
              </button>
            </div>
          </div>

          {/* Tipo de usuário */}
          <div className={styles.formGroup}>
            <label
              className={styles.label}
              style={{
                color: theme.colors.text,
              }}
            >
              Tipo de Usuario
            </label>

            <div
              className={
                styles.labelWrapper
              }
            >
              <select
                className={styles.input}
                style={inputTheme}
                value={TipoUsuario}
                onChange={(event) =>
                  setTipoUsuario(
                    event.target.value
                  )
                }
                required
              >
                <option value="autonomo" style={{color: theme.colors.text}}>
                  Autonomo
                </option>

                <option value="empresa" style={{color: theme.colors.text}}>
                  Empresa
                </option>

                <option value="profissional" style={{color: theme.colors.text}}>
                  Profissional
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
                Empresa
              </label>

              <div
                className={
                  styles.labelWrapper
                }
              >
                <select
                  className={styles.input}
                  style={inputTheme}
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
                      ? "Carregando empresas..."
                      : empresas.length ===
                          0
                        ? "Nenhuma empresa encontrada"
                        : "Selecione uma empresa"}
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
                    Nenhuma empresa
                    encontrada nesta
                    cidade.
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
                  Nome Fantasia
                </label>

                <input
                  type="text"
                  className={
                    styles.input
                  }
                  style={inputTheme}
                  value={nomeFantasia}
                  onChange={(event) =>
                    setNomeFantasia(
                      event.target.value
                    )
                  }
                  placeholder="Digite o nome fantasia"
                  required
                />
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

                <input
                  type="text"
                  className={
                    styles.input
                  }
                  style={inputTheme}
                  value={cnpj}
                  onChange={(event) =>
                    setCnpj(
                      event.target.value
                    )
                  }
                  placeholder="Digite o CNPJ"
                  required
                />
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
              Ja tenho uma conta
            </Link>
          </div>

          {/* Botão cadastrar */}
          <button
            type="submit"
            className={
              isFormValid() && !loading
                ? styles.button
                : styles.buttonDisabled
            }
            style={{
              backgroundColor:
                isFormValid() && !loading
                  ? theme.colors.primary
                  : theme.colors.inactive,

              color: theme.colors.onPrimary,
            }}
            disabled={
              !isFormValid() ||
              loading ||
              loadingEmpresas
            }
          >
            {loading ? (
              <span
                className={
                  styles.spinner
                }
              />
            ) : (
              "Cadastrar"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Register;
