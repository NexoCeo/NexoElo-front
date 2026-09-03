import { useEffect, useState } from "react";
import { FaEnvelope, FaEye, FaEyeSlash, FaPhoneAlt, FaPlus, FaUser } from "react-icons/fa";
import { Link } from "react-router-dom";
import { useClienteFinalRegisterForm } from "@/hooks/useClienteFinalRegisterForm";
import styles from "../style.module.css";

export default function ClienteFinalRegister() {
  const {
    nome,
    email,
    telefone,
    senha,
    confirmarSenha,
    fotoPerfil,
    showPassword,
    error,
    loading,
    redirectTo,
    setNome,
    setEmail,
    setTelefone,
    setSenha,
    setConfirmarSenha,
    setFotoPerfil,
    setShowPassword,
    isFormValid,
    handleSubmit,
  } = useClienteFinalRegisterForm();
  const [previewUrl, setPreviewUrl] = useState("");
  const loginPath = redirectTo
    ? `/cliente-final/login?redirectTo=${encodeURIComponent(redirectTo)}`
    : "/cliente-final/login";

  useEffect(() => {
    if (!fotoPerfil) {
      setPreviewUrl("");
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(fotoPerfil);
    setPreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [fotoPerfil]);

  return (
    <main className={styles.container}>
      <form className={styles.panel} onSubmit={handleSubmit}>
        <div className={styles.heading}>
          <span className={styles.mark}>CF</span>
          <h1>Criar conta</h1>
        </div>

        <div className={styles.photoField}>
          <span>Foto de perfil</span>
          <label className={styles.photoControl}>
            <span className={styles.photoPreview}>
              {previewUrl ? (
                <img src={previewUrl} alt="Foto de perfil selecionada" />
              ) : (
                <FaPlus />
              )}
            </span>
            <strong>{fotoPerfil ? fotoPerfil.name : "Selecionar foto"}</strong>
            <input
              className={styles.photoInput}
              type="file"
              accept="image/*"
              onChange={(event) => setFotoPerfil(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <label className={styles.field}>
          Nome completo
          <div className={styles.inputWrap}>
            <input
              type="text"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="Seu nome"
            />
            <span><FaUser /></span>
          </div>
        </label>

        <label className={styles.field}>
          E-mail
          <div className={styles.inputWrap}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@exemplo.com"
            />
            <span><FaEnvelope /></span>
          </div>
        </label>

        <label className={styles.field}>
          Telefone
          <div className={styles.inputWrap}>
            <input
              type="tel"
              value={telefone}
              onChange={(event) => setTelefone(event.target.value)}
              placeholder="(11) 99999-9999"
            />
            <span><FaPhoneAlt /></span>
          </div>
        </label>

        <label className={styles.field}>
          Senha
          <div className={styles.inputWrap}>
            <input
              type={showPassword ? "text" : "password"}
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              placeholder="Minimo de 6 caracteres"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Alternar senha">
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
        </label>

        <label className={styles.field}>
          Confirmar senha
          <div className={styles.inputWrap}>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmarSenha}
              onChange={(event) => setConfirmarSenha(event.target.value)}
              placeholder="Repita sua senha"
            />
          </div>
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.submit} type="submit" disabled={!isFormValid() || loading}>
          {loading ? "Criando..." : "Cadastrar"}
        </button>

        <Link className={styles.link} to={loginPath}>
          Ja tenho conta
        </Link>
      </form>
    </main>
  );
}
