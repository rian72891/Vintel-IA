import { PanelLeftOpen } from 'lucide-react';
import { Sidebar } from '@/components/chat/Sidebar';
import { AgentSelector } from '@/components/chat/AgentSelector';
import { ChatView } from '@/components/chat/ChatView';
import { useChatStore } from '@/store/chatStore';

const Index = () => {
  const { activeConversationId, sidebarOpen, setSidebarOpen } = useChatStore();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col relative">
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-3 left-3 z-10 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        {activeConversationId ? <ChatView /> : <AgentSelector />}
      </div>
    </div>
  );
};

export default Index;
