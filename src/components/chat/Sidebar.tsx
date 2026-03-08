import { Plus, MessageSquare, PanelLeftClose, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '@/store/chatStore';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { conversations, activeConversationId, sidebarOpen, setSidebarOpen, setActiveConversation, createConversation, setSelectedAgent } = useChatStore();

  const handleNewChat = () => {
    setSelectedAgent(null);
    setActiveConversation(null);
  };

  return (
    <AnimatePresence>
      {sidebarOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 280, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="h-screen flex flex-col bg-sidebar border-r border-sidebar-border overflow-hidden"
        >
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-display font-semibold text-foreground tracking-tight">NexusAI</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          <div className="px-3 mb-2">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nova conversa
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-1 space-y-0.5">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConversation(conv.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors truncate',
                  conv.id === activeConversationId
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{conv.title}</span>
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-foreground font-medium text-xs">U</div>
              <span>Usuário</span>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
