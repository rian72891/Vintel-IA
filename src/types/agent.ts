export type AgentType = 'research' | 'coder' | 'business' | 'content' | 'automation';

export interface Agent {
  id: AgentType;
  name: string;
  description: string;
  icon: string;
  capabilities: string[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent?: AgentType;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  agent?: AgentType;
  createdAt: Date;
  updatedAt: Date;
}
