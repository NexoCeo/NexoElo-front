import { useLanguage } from "@/context/LanguageContext";
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
  const { t } = useLanguage();
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
          <h1>{t("auth.createAccount")}</h1>
        </div>

        <div className={styles.photoField}>
          <span>{t("profile.photo")}</span>
          <label className={styles.photoControl}>
            <span className={styles.photoPreview}>
              {previewUrl ? (
                <img src={previewUrl} alt="Foto de perfil selecionada" />
              ) : (
                <FaPlus />
              )}
            </span>
            <strong>{fotoPerfil ? fotoPerfil.name : t("pros.photo")}</strong>
            <input
              className={styles.photoInput}
              type="file"
              accept="image/*"
              onChange={(event) => setFotoPerfil(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <label className={styles.field}>
          {t("auth.fullName")}
          <div className={styles.inputWrap}>
            <input
              type="text"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder={t("auth.yourName")}
            />
            <span><FaUser /></span>
          </div>
        </label>

        <label className={styles.field}>
          {t("auth.email")}
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
          {t("profile.phone")}
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
          {t("auth.password")}
          <div className={styles.inputWrap}>
            <input
              type={showPassword ? "text" : "password"}
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              placeholder={t("auth.minPassword")}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={t("auth.showPassword")}>
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
        </label>

        <label className={styles.field}>
          {t("auth.confirmPassword")}
          <div className={styles.inputWrap}>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmarSenha}
              onChange={(event) => setConfirmarSenha(event.target.value)}
              placeholder={t("auth.repeatPassword")}
            />
          </div>
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.submit} type="submit" disabled={!isFormValid() || loading}>
          {loading ? t("auth.creating") : t("auth.register")}
        </button>

        <Link className={styles.link} to={loginPath}>
          {t("auth.haveCustomerAccount")}
        </Link>
      </form>
    </main>
  );
}
