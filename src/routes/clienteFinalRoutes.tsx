import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import ClienteFinalProtectedRoute from "@/components/ClienteFinalProtectedRoute";

import ClienteFinalLogin from "@/pages/cliente-final/auth/login";
import ClienteFinalRegister from "@/pages/cliente-final/auth/register";
import ClienteFinalAgendar from "@/pages/cliente-final/agendar";
import ClienteFinalHome from "@/pages/cliente-final/home";

import { getClienteFinalUser } from "@/services/cliente-final-auth-token";

export default function ClienteFinalRoutes() {
  const cliente = getClienteFinalUser();

  const initialPath =
    cliente?.TipoUsuario?.toUpperCase() === "CLIENTE"
      ? "home"
      : "login";

  return (
    <Routes>
      {/* Ao acessar /cliente-final */}
      <Route
        index
        element={
          <Navigate
            to={initialPath}
            replace
          />
        }
      />

      <Route
        path="login"
        element={<ClienteFinalLogin />}
      />

      <Route
        path="register"
        element={<ClienteFinalRegister />}
      />

      <Route
        path="home"
        element={
          <ClienteFinalProtectedRoute>
            <ClienteFinalHome />
          </ClienteFinalProtectedRoute>
        }
      />

      <Route
        path="agendar"
        element={<ClienteFinalAgendar />}
      />

      <Route
        path="agendar/:username"
        element={<ClienteFinalAgendar />}
      />

      {/* Rota de cliente inexistente */}
      <Route
        path="*"
        element={
          <Navigate
            to={initialPath}
            replace
          />
        }
      />
    </Routes>
  );
}
