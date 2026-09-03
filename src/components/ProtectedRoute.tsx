import { Navigate, useLocation } from "react-router-dom";
import { getRoleDashboardPath, normalizeRole } from "@/routes/role-paths";
import { getStoredUser } from "@/services/auth-token";

interface Props {
  children: React.ReactNode;
  redirectTo?: string;
}

export default function ProtectedRoute({ children, redirectTo = "/global/login" }: Props) {
  const location = useLocation();
  const usuario = getStoredUser<{ Papel?: string; TipoUsuario?: string }>();

  if (!usuario) {
    return <Navigate to={redirectTo} replace />;
  }

  try {
    const userRole = normalizeRole(usuario.Papel || usuario.TipoUsuario);
    const routeRole = normalizeRole(location.pathname.split("/")[1]);

    if (!userRole) {
      return <Navigate to={redirectTo} replace />;
    }

    if (routeRole && userRole !== routeRole) {
      return <Navigate to={getRoleDashboardPath(userRole)} replace />;
    }
  } catch {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}
