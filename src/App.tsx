import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { SubscriptionProvider } from "@/hooks/useSubscription";
import { UsageProvider } from "@/hooks/useUsage";
import Index from "./pages/Index";
import Precos from "./pages/Precos";
import Obrigado from "./pages/Obrigado";
import Cancelar from "./pages/Cancelar";
import Upgrade from "./pages/Upgrade";
import SharedArtifacts from "./pages/SharedArtifacts";
import Conectores from "./pages/Conectores";
import OAuthCallback from "./pages/OAuthCallback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <UsageProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/precos" element={<Precos />} />
                <Route path="/plans" element={<Precos />} />
                <Route path="/obrigado" element={<Obrigado />} />
                <Route path="/cancelar" element={<Cancelar />} />
                <Route path="/upgrade" element={<Upgrade />} />
                <Route path="/shared/:id" element={<SharedArtifacts />} />
                <Route path="/conectores" element={<Conectores />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </UsageProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
