import { Navigate, Route, Routes } from "react-router-dom";
import ClienteFinalProtectedRoute from "@/components/ClienteFinalProtectedRoute";
import ClienteFinalLogin from "@/pages/cliente-final/auth/login";
import ClienteFinalRegister from "@/pages/cliente-final/auth/register";
import ClienteFinalAgendar from "@/pages/cliente-final/agendar";
import ClienteFinalHome from "@/pages/cliente-final/home";

export default function ClienteFinalRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="login" replace />} />
      <Route path="login" element={<ClienteFinalLogin />} />
      <Route path="register" element={<ClienteFinalRegister />} />
      <Route path="home" element={<ClienteFinalProtectedRoute><ClienteFinalHome /></ClienteFinalProtectedRoute>} />
      <Route path="agendar" element={<ClienteFinalAgendar />} />
      <Route path="agendar/:username" element={<ClienteFinalAgendar />} />
      <Route path="*" element={<Navigate to="login" replace />} />
    </Routes>
  );
}
