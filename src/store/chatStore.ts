import { create } from 'zustand';
import { AgentType, Conversation, Message } from '@/types/agent';
import { supabase } from '@/integrations/supabase/client';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  selectedAgent: AgentType | null;
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  loaded: boolean;

  setSelectedAgent: (agent: AgentType | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  createConversation: (agent?: AgentType) => Promise<string | null>;
  setActiveConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: Omit<Message, 'id' | 'timestamp'>) => Promise<void>;
  getActiveConversation: () => Conversation | undefined;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
}

const savedTheme = (typeof window !== 'undefined' && localStorage.getItem('ventel-theme') as 'light' | 'dark') || 'dark';
if (typeof window !== 'undefined') {
  document.documentElement.classList.toggle('dark', savedTheme === 'dark');
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  selectedAgent: null,
  sidebarOpen: true,
  theme: savedTheme,
  loaded: false,

  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setTheme: (theme) => {
    localStorage.setItem('ventel-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    set({ theme });
  },

  loadConversations: async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const { data } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (data) {
      const convs: Conversation[] = data.map((c: any) => ({
        id: c.id,
        title: c.title,
        messages: [],
        agent: c.agent as AgentType | undefined,
        createdAt: new Date(c.created_at),
        updatedAt: new Date(c.updated_at),
      }));
      set({ conversations: convs, loaded: true });
    }
  },

  loadMessages: async (conversationId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (data) {
      const msgs: Message[] = data.map((m: any) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        agent: m.agent as AgentType | undefined,
        timestamp: new Date(m.created_at),
        attachments: m.attachments || [],
      }));
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, messages: msgs } : c
        ),
      }));
    }
  },

  createConversation: async (agent) => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return null;

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: session.session.user.id,
        title: 'Nova conversa',
        agent: agent || null,
      } as any)
      .select()
      .single();

    if (error || !data) return null;

    const conversation: Conversation = {
      id: data.id,
      title: data.title,
      messages: [],
      agent: data.agent as AgentType | undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };

    set((state) => ({
      conversations: [conversation, ...state.conversations],
      activeConversationId: data.id,
      selectedAgent: agent || state.selectedAgent,
    }));

    return data.id;
  },

  setActiveConversation: (id) => {
    set({ activeConversationId: id });
    if (id) {
      const conv = get().conversations.find((c) => c.id === id);
      if (conv && conv.messages.length === 0) {
        get().loadMessages(id);
      }
    }
  },

  addMessage: async (conversationId, message) => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const { data } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: session.session.user.id,
        role: message.role,
        content: message.content,
        agent: message.agent || null,
        attachments: (message.attachments || []) as any,
      } as any)
      .select()
      .single();

    if (!data) return;

    const msg: Message = {
      id: data.id,
      role: data.role as 'user' | 'assistant' | 'system',
      content: data.content,
      agent: data.agent as AgentType | undefined,
      timestamp: new Date(data.created_at),
      attachments: data.attachments as any || [],
    };

    // Update title on first user message
    const conv = get().conversations.find((c) => c.id === conversationId);
    if (conv && conv.messages.length === 0 && message.role === 'user') {
      const newTitle = message.content.slice(0, 40) + (message.content.length > 40 ? '...' : '');
      await supabase.from('conversations').update({ title: newTitle, updated_at: new Date().toISOString() }).eq('id', conversationId);
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, title: newTitle, messages: [...c.messages, msg], updatedAt: new Date() } : c
        ),
      }));
    } else {
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, messages: [...c.messages, msg], updatedAt: new Date() } : c
        ),
      }));
    }
  },

  deleteConversation: async (id) => {
    await supabase.from('conversations').delete().eq('id', id);
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
    }));
  },

  renameConversation: async (id, title) => {
    await supabase.from('conversations').update({ title }).eq('id', id);
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title } : c
      ),
    }));
  },

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get();
    return conversations.find((c) => c.id === activeConversationId);
  },
}));
