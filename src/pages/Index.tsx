import { useState } from 'react';
import { Menu, Download } from 'lucide-react';
import vintelLogo from '@/assets/vintel-logo.png';
import { Sidebar } from '@/components/chat/Sidebar';
import { AgentSelector } from '@/components/chat/AgentSelector';
import { ChatView } from '@/components/chat/ChatView';
import { AuthModal } from '@/components/AuthModal';
import { WelcomeModal } from '@/components/WelcomeModal';
import { useChatStore } from '@/store/chatStore';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const { activeConversationId, sidebarOpen, setSidebarOpen, createConversation } = useChatStore();
  const { user } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const userInitial = user?.user_metadata?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || '?';

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {user && <Sidebar />}

      <div className="flex-1 flex flex-col relative min-w-0">
        {/* Minimal Header */}
        {user && !sidebarOpen && (
          <header className="flex items-center justify-between px-4 py-2.5 bg-background will-change-transform">
            {/* Left: menu */}
            <div className="w-10">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-95"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>

            {/* Center: download */}
            <a
              href="/install-Vintel-IA.html"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-shimmer group relative flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-300 ease-out hover:shadow-primary/40 hover:scale-[1.03] active:scale-[0.97]"
            >
              <Download className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
              <span>Baixar app</span>
            </a>

            {/* Right: user avatar */}
            <div className="w-10 flex justify-end">
              <div className="relative">
                <div className="h-8 w-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center">
                  <span className="text-xs font-semibold text-primary">{userInitial}</span>
                </div>
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />
              </div>
            </div>
          </header>
        )}

        {activeConversationId && user ? (
          <ChatView />
        ) : (
          <div className="flex-1 flex flex-col">
            <AgentSelector onRequireAuth={() => setAuthModalOpen(true)} />
          </div>
        )}
      </div>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </div>
  );
};

export default Index;
