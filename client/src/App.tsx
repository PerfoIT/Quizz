import { Navigate, Route, Routes } from "react-router-dom";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminPage from "./pages/AdminPage";
import DisplayPage from "./pages/DisplayPage";
import HostPage from "./pages/HostPage";
import PlayerPage from "./pages/PlayerPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/host" replace />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/host" element={<HostPage />} />
      <Route path="/display/:sessionCode" element={<DisplayPage />} />
      <Route path="/join/:sessionCode" element={<PlayerPage />} />
    </Routes>
  );
}
