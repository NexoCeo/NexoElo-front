import { Routes, Route, Navigate, useParams } from "react-router-dom";
import GlobalRoutes from './routes/globalRoutes'
import EmpresaRoutes from "./routes/empresaRoutes";
import AutonomoRoutes from "./routes/autonomoRoutes";
import ProfissionalRoutes from "./routes/profissionalRoutes";
import ClienteFinalRoutes from "./routes/clienteFinalRoutes";
import { getClienteFinalUser } from "./services/cliente-final-auth-token";
import { getStoredUser } from "./services/auth-token";
import { getRoleDashboardPath, getRolePagePath } from "./routes/role-paths";

function getInitialRoute() {
  if (getClienteFinalUser()) {
    return "/cliente-final/home";
  }

  const usuario = getStoredUser<{ Papel?: string }>();
  if (!usuario) {
    return "/global/login";
  }

  return getRoleDashboardPath(usuario.Papel);
}

function getLegacyRoleRoute(page: string) {
  const usuario = getStoredUser<{ Papel?: string }>();
  return getRolePagePath(usuario?.Papel, page);
}

function LegacyAgendarRedirect() {
  const { username } = useParams();
  return <Navigate to={`/cliente-final/agendar/${username ?? ""}`} replace />;
}

export default function App() {
  const initialRoute = getInitialRoute();

  return (
    <Routes>
      <Route path="/" element={<Navigate to={initialRoute} replace />} />
      <Route path="/global/*" element={<GlobalRoutes />} />
      <Route path="/empresa/*" element={<EmpresaRoutes />} />
      <Route path="/autonomo/*" element={<AutonomoRoutes />} />
      <Route path="/profissional/*" element={<ProfissionalRoutes />} />
      <Route path="/cliente-final/*" element={<ClienteFinalRoutes />} />
      <Route path="/agendar" element={<Navigate to="/cliente-final/agendar" replace />} />
      <Route path="/agendar/:username" element={<LegacyAgendarRedirect />} />
      <Route path="/servicos" element={<Navigate to={getLegacyRoleRoute("servicos")} replace />} />
      <Route path="/prestador/*" element={<Navigate to="/empresa/dashboard" replace />} />
    </Routes>
  )
}
