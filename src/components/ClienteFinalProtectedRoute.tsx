import { Navigate, useLocation } from "react-router-dom";
import { getClienteFinalUser } from "@/services/cliente-final-auth-token";

type ClienteFinalProtectedRouteProps = {
  children: React.ReactNode;
};

export default function ClienteFinalProtectedRoute({ children }: ClienteFinalProtectedRouteProps) {
  const location = useLocation();
  const cliente = getClienteFinalUser();

  if (!cliente || cliente.TipoUsuario !== "CLIENTE") {
    const redirectTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/cliente-final/login?redirectTo=${encodeURIComponent(redirectTo)}`} replace />;
  }

  return children;
}
