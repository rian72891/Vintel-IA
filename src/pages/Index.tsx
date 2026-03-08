import { Menu, PanelLeftOpen } from 'lucide-react';
import { Sidebar } from '@/components/chat/Sidebar';
import { AgentSelector } from '@/components/chat/AgentSelector';
import { ChatView } from '@/components/chat/ChatView';
import { useChatStore } from '@/store/chatStore';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const { activeConversationId, sidebarOpen, setSidebarOpen } = useChatStore();
  const { user } = useAuth();

  const userInitial = user?.user_metadata?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || '?';

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col relative">
        {/* Top bar when sidebar is closed */}
        {!sidebarOpen && (
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="h-7 w-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <span className="text-[10px] font-semibold text-primary">{userInitial}</span>
            </div>
          </div>
        )}

        {activeConversationId ? <ChatView /> : <AgentSelector />}
      </div>
    </div>
  );
};

export default Index;
