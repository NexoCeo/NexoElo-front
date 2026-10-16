import { useLanguage } from "@/context/LanguageContext";
import { useState } from "react";
import Step1SolicitarEmail from '@/pages/auth/forgotPassword/SolicitaEmail'; 
import Step2Codigo from '@/pages/auth/forgotPassword/ValidaCodigo';
import StepAlterarSenha from '@/pages/auth/forgotPassword/AlteraSenha'; 
import styles from "./step.module.css";
import { useNotification } from "@/context/NotificationContext";

export default function ForgotPasswordFlow() {
  const { t } = useLanguage();
  const { showNotification } = useNotification();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [tokenTemporario, setTokenTemporario] = useState('');

  const handleEmailSubmitted = (submittedEmail: string) => {
    setEmail(submittedEmail);
    setStep(2);
  };

  const handleCodigoValidated = (token: string) => {
    setTokenTemporario(token);
    setStep(3);
  };

  const handlePasswordChanged = () => {
    showNotification({
      type: "success",
      title: t("password.changed"),
      message: t("password.changedDesc"),
    });
    setStep(1); // Reinicia o fluxo
  };

  const handleStepFailed = () => {
    showNotification({
      type: "error",
      title: t("password.failed"),
      message: t("password.check"),
    });
  };

  // 1. Crie a função que lida com a falha na alteração da senha
  const handlePasswordChangeFailed = () => {
      showNotification({
        type: "error",
        title: t("password.notChanged"),
        message: t("password.tryAgain"),
      });
      setStep(1); // Opcional: retorna o usuário para a tela inicial
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return <Step1SolicitarEmail onSuccess={handleEmailSubmitted} onFailure={handleStepFailed} />;
      case 2:
        return <Step2Codigo email={email} onSuccess={handleCodigoValidated} onFailure={handleStepFailed} />;
      case 3:
        return (
          <StepAlterarSenha
            tokenTemporario={tokenTemporario}
            onSuccess={handlePasswordChanged}
            onFailure={handlePasswordChangeFailed} // 2. Passe a função para o componente filho
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.mainContainer}>
      <h2 className={styles.title}>{t("password.reset")}</h2>
      {renderStep()}
    </div>
  );
}
