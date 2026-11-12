import { StrictMode } from 'react'
import { BrowserRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.tsx'
import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider } from "./context/LanguageContext";
import { UserProvider } from './context/UserContext.tsx';
import { NotificationProvider } from './context/NotificationContext.tsx';
import { migrateLegacyAuthSession } from "./services/legacy-auth-migration.ts";

// O PWA pode manter assets de um deploy anterior ate a troca do service worker.
// Verificamos atualizacoes ao carregar e recarregamos uma unica vez quando
// a nova versao passa a controlar esta aba.
if ("serviceWorker" in navigator) {
  let updatingPage = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (updatingPage) return;
    updatingPage = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    void navigator.serviceWorker.getRegistration()
      .then(registration => registration?.update())
      .catch(() => undefined);
  }, { once: true });
}

function bootstrap() {
  // A migração copia os dados legados de sessão de forma síncrona antes da
  // requisição HTTP. Não aguardar a API: servidores em cold start podem
  // demorar até o timeout e deixar a tela completamente em branco.
  void migrateLegacyAuthSession().catch((error) => {
    console.error("Não foi possível concluir a migração da sessão.", error);
  });

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <LanguageProvider>
        <ThemeProvider>
          <UserProvider>
            <NotificationProvider>
              <App />
            </NotificationProvider>
          </UserProvider>
        </ThemeProvider>
        </LanguageProvider>
      </BrowserRouter>
    </StrictMode>
  )
}

void bootstrap();
