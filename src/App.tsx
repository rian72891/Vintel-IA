import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SubscriptionProvider } from "@/hooks/useSubscription";
import { UsageProvider } from "@/hooks/useUsage";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Precos from "./pages/Precos";
import Obrigado from "./pages/Obrigado";
import Cancelar from "./pages/Cancelar";
import Upgrade from "./pages/Upgrade";
import SharedArtifacts from "./pages/SharedArtifacts";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/shared/:id" element={<SharedArtifacts />} />
        <Route path="*" element={<Auth />} />
      </Routes>
    );
  }

  return (
    <SubscriptionProvider>
      <UsageProvider>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/precos" element={<Precos />} />
          <Route path="/plans" element={<Precos />} />
          <Route path="/obrigado" element={<Obrigado />} />
          <Route path="/cancelar" element={<Cancelar />} />
          <Route path="/upgrade" element={<Upgrade />} />
          <Route path="/shared/:id" element={<SharedArtifacts />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </UsageProvider>
    </SubscriptionProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
