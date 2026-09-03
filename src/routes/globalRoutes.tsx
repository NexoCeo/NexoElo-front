import { Routes, Route } from "react-router-dom";

import Login from '@/pages/auth/signin';
import Register from "@/pages/auth/signup/index";
import RecuperarSenha from "@/pages/auth/forgotPassword"
export default function GlobalRoutes() {
  return (
    <Routes>
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="recuperarSenha" element={<RecuperarSenha />} />
    </Routes>
  )
}
