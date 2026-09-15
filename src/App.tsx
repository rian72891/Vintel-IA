import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { SubscriptionProvider } from "@/hooks/useSubscription";
import { UsageProvider } from "@/hooks/useUsage";
import { I18nProvider } from "@/lib/i18n";
import Index from "./pages/Index";
import Precos from "./pages/Precos";
import Obrigado from "./pages/Obrigado";
import Cancelar from "./pages/Cancelar";
import Upgrade from "./pages/Upgrade";
import SharedArtifacts from "./pages/SharedArtifacts";
import Conectores from "./pages/Conectores";
import GithubAgent from "./pages/GithubAgent";
import OAuthCallback from "./pages/OAuthCallback";
import Auth from "./pages/Auth";

import Termos from "./pages/Termos";
import Status from "./pages/Status";
import Tarefas from "./pages/Tarefas";
import MinhasTarefas from "./pages/MinhasTarefas";
import Privacidade from "./pages/Privacidade";
import NotFound from "./pages/NotFound";
import { NetworkStatusBadge } from "./components/NetworkStatusBadge";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <I18nProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <UsageProvider>
            <Toaster />
            <Sonner />
            <NetworkStatusBadge />
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
                <Route path="/github-agent" element={<GithubAgent />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/callback/:provider" element={<OAuthCallback />} />

                <Route path="/status" element={<Status />} />
                <Route path="/tarefas" element={<Tarefas />} />
                <Route path="/minhas-tarefas" element={<MinhasTarefas />} />
                <Route path="/termos" element={<Termos />} />
                <Route path="/privacidade" element={<Privacidade />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </UsageProvider>
        </SubscriptionProvider>
      </AuthProvider>
      </I18nProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
