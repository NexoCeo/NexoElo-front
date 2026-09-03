import { FaEye, FaEyeSlash, FaUser } from "react-icons/fa";
import { Link } from "react-router-dom";
import { useClienteFinalLoginForm } from "@/hooks/useClienteFinalLoginForm";
import { useTheme } from '@/context/ThemeContext';
import styles from "../style.module.css";

export default function ClienteFinalLogin() {
  const { theme } = useTheme();
  const {
    login,
    senha,
    showPassword,
    error,
    loading,
    redirectTo,
    setLogin,
    setSenha,
    setShowPassword,
    isFormValid,
    handleLogin,
  } = useClienteFinalLoginForm();
  const registerPath = redirectTo
    ? `/cliente-final/register?redirectTo=${encodeURIComponent(redirectTo)}`
    : "/cliente-final/register";

  return (
    <main className={styles.container}>
      <form className={styles.panel} onSubmit={handleLogin}>
        <div className={styles.heading}>
          <span className={styles.mark}>CF</span>
          <h1>Entrar como cliente</h1>
        </div>

        <label className={styles.field}>
          E-mail ou telefone
          <div className={styles.inputWrap}>
            <input
              type="text"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              placeholder="exemplo@mail.com ou 28993337212"
            />
            <span><FaUser /></span>
          </div>
        </label>

        <label className={styles.field}>
          Senha
          <div className={styles.inputWrap}>
            <input
              type={showPassword ? "text" : "password"}
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              placeholder="Digite sua senha"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Alternar senha">
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.submit} type="submit" disabled={!isFormValid() || loading} style={{ backgroundColor: theme.colors.primary, color: theme.colors.onPrimary }}>
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <Link className={styles.link} to={registerPath}>
          Criar conta de cliente
        </Link>
      </form>
    </main>
  );
}
