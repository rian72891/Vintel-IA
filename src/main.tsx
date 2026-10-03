import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/registerServiceWorker";
import { Sentry } from "./lib/sentry";
import { ErrorFallback } from "./components/ErrorFallback";

/**
 * Rede de segurança global: qualquer rejeição de promessa que escape dos
 * try/catch dos handlers (ex.: edge function retornando 429/500) vira um
 * aviso discreto em vez de derrubar a tela inteira.
 */
function friendlyGlobalError(reason: unknown): string {
  const msg =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : String(reason ?? "");
  if (/429|Muitas requisi/i.test(msg))
    return "Muitas requisições em pouco tempo. Aguarde alguns segundos e tente de novo.";
  if (/401|403|sess/i.test(msg)) return "Sua sessão expirou. Faça login novamente para continuar.";
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg))
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  return "Algo saiu errado, mas seu trabalho está salvo. Tente novamente.";
}

window.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  console.error("[unhandledrejection]", event.reason);
  toast.error(friendlyGlobalError(event.reason));
});

window.addEventListener("error", (event) => {
  // Erros de render já são cobertos pelo ErrorBoundary; aqui só evitamos
  // que erros soltos de scripts/handlers quebrem a página em silêncio.
  if (event.error) return;
  event.preventDefault();
  console.error("[window.onerror]", event.message);
});

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
    <App />
  </Sentry.ErrorBoundary>,
);

registerServiceWorker();
