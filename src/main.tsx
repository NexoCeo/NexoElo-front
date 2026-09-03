import { StrictMode } from 'react'
import { BrowserRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.tsx'
import { ThemeProvider } from "./context/ThemeContext";
import { UserProvider } from './context/UserContext.tsx';
import { NotificationProvider } from './context/NotificationContext.tsx';
import { migrateLegacyAuthSession } from "./services/legacy-auth-migration.ts";

async function bootstrap() {
  await migrateLegacyAuthSession();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <ThemeProvider>
          <UserProvider>
            <NotificationProvider>
              <App />
            </NotificationProvider>
          </UserProvider>
        </ThemeProvider>
      </BrowserRouter>
    </StrictMode>
  )
}

void bootstrap();
