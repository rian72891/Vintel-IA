import { useState } from 'react';
import { Plus, MessageSquare, PanelLeftClose, Zap, Trash2, Pencil, Check, X, Settings, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '@/store/chatStore';
import { cn } from '@/lib/utils';
import { SettingsDialog } from './SettingsDialog';

export function Sidebar() {
  const { conversations, activeConversationId, sidebarOpen, setSidebarOpen, setActiveConversation, setSelectedAgent, deleteConversation, renameConversation } = useChatStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleNewChat = () => {
    setSelectedAgent(null);
    setActiveConversation(null);
  };

  const startRename = (id: string, title: string) => {
    setEditingId(id);
    setEditTitle(title);
  };

  const confirmRename = () => {
    if (editingId && editTitle.trim()) {
      renameConversation(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <>
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-screen flex flex-col bg-sidebar border-r border-sidebar-border overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                  <Zap className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-semibold text-foreground tracking-tight text-sm">NexusIA</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            {/* New Chat */}
            <div className="px-3 mb-3">
              <button
                onClick={handleNewChat}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors"
              >
                <Plus className="h-4 w-4" />
                Nova conversa
              </button>
            </div>

            {/* Conversations */}
            <div className="px-3 mb-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-2">Conversas</span>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-1 space-y-0.5">
              {conversations.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-4 text-center">Nenhuma conversa ainda</p>
              )}
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    'group flex items-center gap-1 rounded-lg text-sm transition-colors',
                    conv.id === activeConversationId
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {editingId === conv.id ? (
                    <div className="flex-1 flex items-center gap-1 px-2 py-1.5">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
                        className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        autoFocus
                      />
                      <button onClick={confirmRename} className="p-1 text-primary hover:bg-muted rounded"><Check className="h-3 w-3" /></button>
                      <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground hover:bg-muted rounded"><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setActiveConversation(conv.id)}
                        className="flex-1 flex items-center gap-2 px-3 py-2 text-left truncate"
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{conv.title}</span>
                      </button>
                      <div className="hidden group-hover:flex items-center pr-1">
                        <button onClick={() => startRename(conv.id, conv.title)} className="p-1 rounded hover:bg-background/50">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={() => deleteConversation(conv.id)} className="p-1 rounded hover:bg-background/50 text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom */}
            <div className="p-3 border-t border-sidebar-border space-y-1">
              <button
                onClick={() => setSettingsOpen(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Settings className="h-4 w-4" />
                Configurações
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
