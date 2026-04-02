import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";

import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import UploadPage from "./pages/UploadPage";
import JacimentForm from "./pages/JacimentForm";
import UEForm from "./pages/UEForm";
import ObjecteForm from "./pages/ObjecteForm";
import SearchPage from "./pages/SearchPage";
import MyItemsPage from "./pages/MyItemsPage";
import ProfilePage from "./pages/ProfilePage";
import ObjecteDetail from "./pages/ObjecteDetail";
import JacimentDetail from "./pages/JacimentDetail";
import UEDetail from "./pages/UEDetail";
import { EditJaciment, EditUE, EditObjecte } from "./pages/EditPages";
import MessagesPage from "./pages/MessagesPage";
import MapPage from "./pages/MapPage";
import AIAssistantPage from "./pages/AIAssistantPage";
import TutorialPage from "./pages/TutorialPage";
import UserManagementPage from "./pages/UserManagementPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Carregant...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Carregant...</div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<AuthRoute><AuthPage /></AuthRoute>} />
    <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
    <Route path="/upload" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
    <Route path="/upload/jaciment" element={<ProtectedRoute><JacimentForm /></ProtectedRoute>} />
    <Route path="/upload/ue" element={<ProtectedRoute><UEForm /></ProtectedRoute>} />
    <Route path="/upload/objecte" element={<ProtectedRoute><ObjecteForm /></ProtectedRoute>} />
    <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
    <Route path="/my-items" element={<ProtectedRoute><MyItemsPage /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
    <Route path="/objecte/:id" element={<ProtectedRoute><ObjecteDetail /></ProtectedRoute>} />
    <Route path="/jaciment/:id" element={<ProtectedRoute><JacimentDetail /></ProtectedRoute>} />
    <Route path="/ue/:id" element={<ProtectedRoute><UEDetail /></ProtectedRoute>} />
    <Route path="/edit/jaciment/:id" element={<ProtectedRoute><EditJaciment /></ProtectedRoute>} />
    <Route path="/edit/ue/:id" element={<ProtectedRoute><EditUE /></ProtectedRoute>} />
    <Route path="/edit/objecte/:id" element={<ProtectedRoute><EditObjecte /></ProtectedRoute>} />
    <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
    <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
    <Route path="/ai-assistant" element={<ProtectedRoute><AIAssistantPage /></ProtectedRoute>} />
    <Route path="/tutorial" element={<ProtectedRoute><TutorialPage /></ProtectedRoute>} />
    <Route path="/admin/users" element={<ProtectedRoute><UserManagementPage /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <LanguageProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
