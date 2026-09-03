import {
  Navigate,
  Routes,
  Route,
} from "react-router-dom";

import Login from "@/pages/auth/signin";
import Register from "@/pages/auth/signup";
import RecuperarSenha from "@/pages/auth/forgotPassword";

import { getEntryPath } from "./session-paths";

export default function GlobalRoutes() {
  const entryPath = getEntryPath();

  return (
    <Routes>
      {/* Ao acessar /global */}
      <Route
        index
        element={
          <Navigate
            to={entryPath}
            replace
          />
        }
      />

      <Route
        path="login"
        element={<Login />}
      />

      <Route
        path="register"
        element={<Register />}
      />

      <Route
        path="recuperarSenha"
        element={<RecuperarSenha />}
      />

      {/* Rota global inexistente */}
      <Route
        path="*"
        element={
          <Navigate
            to={entryPath}
            replace
          />
        }
      />
    </Routes>
  );
}
