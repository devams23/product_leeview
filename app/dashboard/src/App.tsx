import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { AppShell } from "./components/layout/AppShell";
import { AppSkeleton } from "./components/ui/Skeleton";
import { Login } from "./pages/Login";
import { Overview } from "./pages/Overview";
import { History } from "./pages/History";
import { SessionDetail } from "./pages/SessionDetail";
import { NotFound } from "./pages/NotFound";
import { Profile } from "./pages/Profile";

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <AppSkeleton />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route element={user ? <AppShell /> : <Navigate to="/login" replace />}>
        <Route path="/dashboard" element={<Overview />} />
        <Route path="/history" element={<History />} />
        <Route path="/session/:sessionId" element={<SessionDetail />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
