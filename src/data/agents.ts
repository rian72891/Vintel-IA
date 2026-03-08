import { Agent } from '@/types/agent';

export const agents: Agent[] = [
  {
    id: 'research',
    name: 'Pesquisador',
    description: 'Pesquisa na internet, coleta informações e resume conteúdos',
    icon: '🔍',
    capabilities: ['Pesquisa web', 'Resumo de artigos', 'Análise de dados', 'Fact-checking'],
  },
  {
    id: 'coder',
    name: 'Programador',
    description: 'Cria, analisa e depura código em qualquer linguagem',
    icon: '⚡',
    capabilities: ['Criação de código', 'Debug', 'Arquitetura', 'Code review'],
  },
  {
    id: 'business',
    name: 'Estrategista',
    description: 'Análise de mercado, estratégias e planejamento de negócios',
    icon: '📊',
    capabilities: ['Análise de mercado', 'Marketing', 'Planejamento', 'Pitch decks'],
  },
  {
    id: 'content',
    name: 'Criador',
    description: 'Criação de artigos, roteiros, posts e copywriting',
    icon: '✍️',
    capabilities: ['Artigos', 'Redes sociais', 'Copywriting', 'Roteiros'],
  },
  {
    id: 'automation',
    name: 'Automação',
    description: 'Cria fluxos automáticos e integra sistemas via APIs',
    icon: '🤖',
    capabilities: ['Workflows', 'APIs', 'Automação', 'Integrações'],
  },
];
