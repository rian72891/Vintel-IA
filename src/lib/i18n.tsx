import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

export type Lang = 'pt' | 'en';

const LS_KEY = 'vintel-lang';

const dict = {
  pt: {
    'common.settings': 'Configurações',
    'common.language': 'Idioma',
    'common.portuguese': 'Português',
    'common.english': 'Inglês',
    'common.back': 'Voltar',
    'common.loading': 'Carregando...',
    'chat.howCanIHelp': 'Como posso ajudar?',
    'chat.sendToStart': 'Envie uma mensagem para começar',
    'chat.export': 'Exportar .md',
    'chat.exported': 'Conversa exportada!',
    'chat.exportEmpty': 'Não há mensagens para exportar',
    'chat.working': 'Vintel IA ainda está trabalhando nisso...',
    'usage.today': 'Você usou {used} de {total} mensagens hoje',
    'usage.unlimited': 'Mensagens ilimitadas hoje',
    'usage.almost': 'Você está perto do limite diário',
    'usage.reached': 'Limite diário de mensagens atingido',
    'status.title': 'Status dos serviços',
    'status.subtitle': 'Disponibilidade em tempo real da plataforma Vintel IA',
    'status.operational': 'Todos os sistemas operacionais',
    'status.degraded': 'Instabilidade em alguns serviços',
    'status.checking': 'Verificando serviços...',
    'status.recheck': 'Verificar novamente',
    'status.lastCheck': 'Última verificação',
    'status.up': 'Operacional',
    'status.down': 'Indisponível',
    'status.app': 'Aplicação web',
    'status.api': 'API / Banco de dados',
    'status.ai': 'Agente de IA',
    'status.auth': 'Autenticação',
  },
  en: {
    'common.settings': 'Settings',
    'common.language': 'Language',
    'common.portuguese': 'Portuguese',
    'common.english': 'English',
    'common.back': 'Back',
    'common.loading': 'Loading...',
    'chat.howCanIHelp': 'How can I help?',
    'chat.sendToStart': 'Send a message to get started',
    'chat.export': 'Export .md',
    'chat.exported': 'Conversation exported!',
    'chat.exportEmpty': 'There are no messages to export',
    'chat.working': 'Vintel IA is still working on this...',
    'usage.today': 'You used {used} of {total} messages today',
    'usage.unlimited': 'Unlimited messages today',
    'usage.almost': 'You are close to the daily limit',
    'usage.reached': 'Daily message limit reached',
    'status.title': 'Service status',
    'status.subtitle': 'Real-time availability of the Vintel IA platform',
    'status.operational': 'All systems operational',
    'status.degraded': 'Some services are degraded',
    'status.checking': 'Checking services...',
    'status.recheck': 'Check again',
    'status.lastCheck': 'Last check',
    'status.up': 'Operational',
    'status.down': 'Unavailable',
    'status.app': 'Web app',
    'status.api': 'API / Database',
    'status.ai': 'AI agent',
    'status.auth': 'Authentication',
  },
} as const;

export type TKey = keyof (typeof dict)['pt'];

function detect(): Lang {
  if (typeof window === 'undefined') return 'pt';
  const saved = localStorage.getItem(LS_KEY) as Lang | null;
  if (saved === 'pt' || saved === 'en') return saved;
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'pt';
}

interface I18nContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'pt',
  setLang: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detect);

  useEffect(() => {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(LS_KEY, l);
    setLangState(l);
  }, []);

  const t = useCallback(
    (key: TKey, vars?: Record<string, string | number>) => {
      let out: string = (dict[lang] as Record<string, string>)[key] ?? (dict.pt as Record<string, string>)[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
      }
      return out;
    },
    [lang],
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
