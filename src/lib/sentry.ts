import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();

/**
 * Configure VITE_SENTRY_DSN com o DSN de um projeto React em sentry.io.
 * Crie uma conta gratuita, crie um projeto React e adicione o DSN no ambiente
 * do frontend (Vercel/local). Sem DSN, o monitoramento permanece desativado.
 *
 * Não enviamos mensagens, tokens, headers de autenticação ou payloads de API.
 */
if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.Authorization;
          delete event.request.headers.authorization;
          delete event.request.headers.apikey;
        }
      }
      return event;
    },
  });
}

export function reportChatRequestError(status: number, errorType: string) {
  if (!dsn) return;
  Sentry.withScope((scope) => {
    scope.setTag('area', 'chat');
    scope.setTag('http_status', String(status));
    scope.setTag('error_type', errorType);
    Sentry.captureMessage('Chat backend request failed', 'error');
  });
}

export { Sentry };
