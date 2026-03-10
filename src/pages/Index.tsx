import { Menu, Plus } from 'lucide-react';
import { Sidebar } from '@/components/chat/Sidebar';
import { AgentSelector } from '@/components/chat/AgentSelector';
import { ChatView } from '@/components/chat/ChatView';
import { useChatStore } from '@/store/chatStore';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const { activeConversationId, sidebarOpen, setSidebarOpen, createConversation } = useChatStore();
  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col relative min-w-0">
        {/* Top bar */}
        {!sidebarOpen && (
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                <span className="text-sm font-semibold text-foreground tracking-tight">Ventel IA</span>
              </div>
            </div>
            <button
              onClick={() => createConversation()}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        )}

        {activeConversationId ? <ChatView /> : <AgentSelector />}
      </div>
    </div>
  );
};

export default Index;
