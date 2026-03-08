import { PanelLeftOpen, Download } from 'lucide-react';
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
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}
          <a
            href="/NEXUSIA_CODIGO_COMPLETO.txt"
            download="NEXUSIA_CODIGO_COMPLETO.txt"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar Código
          </a>
        </div>

        {activeConversationId ? <ChatView /> : <AgentSelector />}
      </div>
    </div>
  );
};

export default Index;
