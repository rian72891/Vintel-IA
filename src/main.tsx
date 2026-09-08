import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/registerServiceWorker";
import { Sentry } from "./lib/sentry";

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<p>Ocorreu um erro inesperado. Recarregue a página e tente novamente.</p>}>
    <App />
  </Sentry.ErrorBoundary>,
);

registerServiceWorker();
