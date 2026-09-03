import { useState } from "react";
import Step1SolicitarEmail from '@/pages/auth/forgotPassword/SolicitaEmail'; 
import Step2Codigo from '@/pages/auth/forgotPassword/ValidaCodigo';
import StepAlterarSenha from '@/pages/auth/forgotPassword/AlteraSenha'; 
import styles from "./step.module.css";
import { useNotification } from "@/context/NotificationContext";

export default function ForgotPasswordFlow() {
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
      title: "Senha alterada",
      message: "Voce ja pode entrar com sua nova senha.",
    });
    setStep(1); // Reinicia o fluxo
  };

  const handleStepFailed = () => {
    showNotification({
      type: "error",
      title: "Nao foi possivel continuar",
      message: "Confira os dados e tente novamente.",
    });
  };

  // 1. Crie a função que lida com a falha na alteração da senha
  const handlePasswordChangeFailed = () => {
      showNotification({
        type: "error",
        title: "Senha nao alterada",
        message: "Tente novamente em instantes.",
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
      <h2 className={styles.title}>Redefinir Senha</h2>
      {renderStep()}
    </div>
  );
}
