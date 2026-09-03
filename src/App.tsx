import {
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";

import GlobalRoutes from "./routes/globalRoutes";
import EmpresaRoutes from "./routes/empresaRoutes";
import AutonomoRoutes from "./routes/autonomoRoutes";
import ProfissionalRoutes from "./routes/profissionalRoutes";
import ClienteFinalRoutes from "./routes/clienteFinalRoutes";

import { getStoredUser } from "./services/auth-token";
import { getRolePagePath } from "./routes/role-paths";
import { getEntryPath } from "./routes/session-paths";

function getLegacyRoleRoute(page: string) {
  const usuario = getStoredUser<{
    Papel?: string;
  }>();

  return getRolePagePath(
    usuario?.Papel,
    page,
  );
}

function LegacyAgendarRedirect() {
  const { username } = useParams();

  return (
    <Navigate
      to={`/cliente-final/agendar/${username ?? ""}`}
      replace
    />
  );
}

export default function App() {
  const entryPath = getEntryPath();

  return (
    <Routes>
      {/* Entrada principal */}
      <Route
        path="/"
        element={
          <Navigate
            to={entryPath}
            replace
          />
        }
      />

      {/* Rotas globais */}
      <Route
        path="/global/*"
        element={<GlobalRoutes />}
      />

      {/* Empresa */}
      <Route
        path="/empresa/*"
        element={<EmpresaRoutes />}
      />

      {/* Autônomo */}
      <Route
        path="/autonomo/*"
        element={<AutonomoRoutes />}
      />

      {/* Profissional */}
      <Route
        path="/profissional/*"
        element={<ProfissionalRoutes />}
      />

      {/* Cliente final */}
      <Route
        path="/cliente-final/*"
        element={<ClienteFinalRoutes />}
      />

      {/* Rotas antigas */}
      <Route
        path="/agendar"
        element={
          <Navigate
            to="/cliente-final/agendar"
            replace
          />
        }
      />

      <Route
        path="/agendar/:username"
        element={<LegacyAgendarRedirect />}
      />

      <Route
        path="/servicos"
        element={
          <Navigate
            to={getLegacyRoleRoute("servicos")}
            replace
          />
        }
      />

      <Route
        path="/prestador/*"
        element={
          <Navigate
            to="/empresa/dashboard"
            replace
          />
        }
      />

      {/* Qualquer URL inexistente */}
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
