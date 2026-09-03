import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import styles from "./style.module.css";
import { useTheme } from '@/context/ThemeContext';
import SolicitaEmail from "./SolicitaEmail";
import ValidaCodigo from "./ValidaCodigo";
import AlteraSenha from "./AlteraSenha";
import { useNotification } from "@/context/NotificationContext";

export default function ForgotPassword() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [tokenTemporario, setTokenTemporario] = useState("");

  const handleEmailSubmitted = (submittedEmail: string) => {
    setEmail(submittedEmail);
    setStep(2);
    showNotification({
      type: "success",
      title: "Codigo enviado",
      message: "Verifique seu e-mail para continuar a recuperacao.",
    });
  };

  const handleCodigoValidated = (token: string) => {
    setTokenTemporario(token);
    setStep(3);
    showNotification({
      type: "success",
      title: "Codigo validado",
      message: "Agora defina sua nova senha.",
    });
  };
  
  const handlePasswordChanged = () => {
    showNotification({
      type: "success",
      title: "Senha alterada",
      message: "Use a nova senha para entrar no sistema.",
    });
    navigate('/global/login');
  };

  const handleEmailSubmissionFailed = () => {
    showNotification({
      type: "error",
      title: "E-mail nao enviado",
      message: "Nao foi possivel enviar o codigo. Tente novamente.",
    });
  };
  
  const handleCodigoValidationFailed = () => {
    showNotification({
      type: "warning",
      title: "Codigo invalido",
      message: "Confira o codigo informado e tente novamente.",
    });
  };

  const handlePasswordChangeFailed = () => {
    showNotification({
      type: "error",
      title: "Senha nao alterada",
      message: "Nao foi possivel concluir a alteracao. Tente novamente.",
    });
    setStep(1);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <SolicitaEmail 
            onSuccess={handleEmailSubmitted} 
            onFailure={handleEmailSubmissionFailed}
          />
        );
      case 2:
        return (
          <ValidaCodigo
            email={email}
            onSuccess={handleCodigoValidated}
            onFailure={handleCodigoValidationFailed}
          />
        );
      case 3:
        return (
          <AlteraSenha
            tokenTemporario={tokenTemporario}
            onSuccess={handlePasswordChanged}
            onFailure={handlePasswordChangeFailed}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.container} style={{ backgroundColor: theme.colors.background }}>
      <div className={styles.wrapper}>
        <div className={styles.headerWrapper}>
          <h1 className={styles.text} style={{ color: theme.colors.text }}>
            {step === 1 ? "Recuperar senha" : step === 2 ? "Validar código" : "Alterar senha"}
          </h1>
        </div>
        <div className={styles.content}>
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
