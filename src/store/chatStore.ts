import { create } from 'zustand';
import { AgentType, Conversation, Message } from '@/types/agent';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  selectedAgent: AgentType | null;
  sidebarOpen: boolean;

  setSelectedAgent: (agent: AgentType | null) => void;
  setSidebarOpen: (open: boolean) => void;
  createConversation: (agent?: AgentType) => string;
  setActiveConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  getActiveConversation: () => Conversation | undefined;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  selectedAgent: null,
  sidebarOpen: true,

  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  createConversation: (agent) => {
    const id = generateId();
    const conversation: Conversation = {
      id,
      title: 'Nova conversa',
      messages: [],
      agent,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      activeConversationId: id,
      selectedAgent: agent || state.selectedAgent,
    }));
    return id;
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  addMessage: (conversationId, message) => {
    const msg: Message = { ...message, id: generateId(), timestamp: new Date() };
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const messages = [...c.messages, msg];
        const title = c.messages.length === 0 && message.role === 'user'
          ? message.content.slice(0, 40) + (message.content.length > 40 ? '...' : '')
          : c.title;
        return { ...c, messages, title, updatedAt: new Date() };
      }),
    }));
  },

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get();
    return conversations.find((c) => c.id === activeConversationId);
  },
}));
