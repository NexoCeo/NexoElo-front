import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import SharedRoleLayout from "@/components/shared-role-layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import ProfessionalAccessGate from "@/components/professional-access-gate";

import Login from "@/pages/auth/signin";
import Register from "@/pages/auth/signup/index";
import RecuperarSenha from "@/pages/auth/forgotPassword";

import Agenda from "@/pages/others/agenda";
import Dashboard from "@/pages/others/dashboard";
import Home from "@/pages/others/home";
import Perfil from "@/pages/others/perfil";
import Profissionais from "@/pages/others/profissionais";
import Servicos from "@/pages/others/servicos";
import Funcionamento from "@/pages/others/funcionamento";
import Relatorios from "@/pages/others/relatorios";

type SharedRoleRoutesProps = {
  allowRegister?: boolean;
  canManageProfessionals?: boolean;
  canManageFuncionamento?: boolean;
  canManageServices?: boolean;
  canViewReports?: boolean;

  requireApprovedProfessional?: boolean;
};

export default function SharedRoleRoutes({
  allowRegister = true,
  canManageProfessionals = false,
  canManageFuncionamento = true,
  canManageServices = true,
  canViewReports = true,

  requireApprovedProfessional = false,
}: SharedRoleRoutesProps) {
  const location = useLocation();

  const noHeaderRoutes = [
    "/login",
    "/register",
    "/recuperarSenha",
  ];

  const showHeader =
    !noHeaderRoutes.some((route) =>
      location.pathname.endsWith(route)
    );

  const routes = (
    <Routes>
      <Route
        index
        element={
          <Navigate
            to="dashboard"
            replace
          />
        }
      />

      <Route
        path="login"
        element={<Login />}
      />

      {allowRegister && (
        <Route
          path="register"
          element={<Register />}
        />
      )}

      <Route
        path="recuperarSenha"
        element={<RecuperarSenha />}
      />

      <Route
        path="home"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />

      <Route
        path="dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="agenda"
        element={
          <ProtectedRoute>
            <Agenda />
          </ProtectedRoute>
        }
      />

      {canManageServices && (
        <Route
          path="servicos"
          element={
            <ProtectedRoute>
              <Servicos />
            </ProtectedRoute>
          }
        />
      )}

      {canManageFuncionamento && (
        <Route
          path="funcionamento"
          element={
            <ProtectedRoute>
              <Funcionamento />
            </ProtectedRoute>
          }
        />
      )}

      {canViewReports && (
        <Route
          path="relatorios"
          element={
            <ProtectedRoute>
              <Relatorios />
            </ProtectedRoute>
          }
        />
      )}

      <Route
        path="perfil"
        element={
          <ProtectedRoute>
            <Perfil />
          </ProtectedRoute>
        }
      />

      {canManageProfessionals && (
        <Route
          path="profissionais"
          element={
            <ProtectedRoute>
              <Profissionais />
            </ProtectedRoute>
          }
        />
      )}

      <Route
        path="*"
        element={
          <Navigate
            to="dashboard"
            replace
          />
        }
      />
    </Routes>
  );

  /*
   * O gate é aplicado somente nas telas
   * internas do profissional.
   *
   * Login e recuperação de senha continuam
   * funcionando normalmente.
   */
  const protectedContent =
    requireApprovedProfessional &&
    showHeader ? (
      <ProfessionalAccessGate>
        {routes}
      </ProfessionalAccessGate>
    ) : (
      routes
    );

  return showHeader ? (
    <SharedRoleLayout>
      {protectedContent}
    </SharedRoleLayout>
  ) : (
    protectedContent
  );
}
