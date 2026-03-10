import { useState, useEffect } from 'react';
import { Plus, MessageSquare, X, Trash2, Pencil, Check, Settings, LogOut, Menu, Search, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '@/store/chatStore';
import { cn } from '@/lib/utils';
import { SettingsDialog } from './SettingsDialog';
import { useAuth } from '@/hooks/useAuth';

export function Sidebar() {
  const { conversations, activeConversationId, sidebarOpen, setSidebarOpen, setActiveConversation, setSelectedAgent, deleteConversation, renameConversation, loadConversations, loaded } = useChatStore();
  const { user, signOut } = useAuth();
  const { plan } = useSubscription();
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!loaded && user) {
      loadConversations();
    }
  }, [loaded, user, loadConversations]);

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

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const userInitial = user?.user_metadata?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || '?';
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';

  return (
    <>
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 z-40 md:hidden"
            />

            <motion.aside
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed md:relative z-50 h-screen w-[280px] flex flex-col bg-sidebar overflow-hidden"
            >
              {/* Header */}
              <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <button
                  onClick={handleNewChat}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Nova conversa"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              {/* Search */}
              <div className="px-3 pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar conversas..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-muted/50 border-0 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30 transition-all"
                  />
                </div>
              </div>

              {/* Conversations list */}
              <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-1 space-y-0.5">
                {filteredConversations.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-3" />
                    <p className="text-xs text-muted-foreground text-center">
                      {searchQuery ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
                    </p>
                  </div>
                )}
                {filteredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={cn(
                      'group flex items-center gap-1 rounded-xl text-sm transition-all duration-150',
                      conv.id === activeConversationId
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    )}
                  >
                    {editingId === conv.id ? (
                      <div className="flex-1 flex items-center gap-1 px-2 py-1.5">
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
                          className="flex-1 bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          autoFocus
                        />
                        <button onClick={confirmRename} className="p-1 text-primary hover:bg-muted rounded"><Check className="h-3 w-3" /></button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground hover:bg-muted rounded"><X className="h-3 w-3" /></button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setActiveConversation(conv.id)}
                          className="flex-1 flex items-center gap-2.5 px-3 py-2.5 text-left truncate"
                        >
                          <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" />
                          <span className="truncate text-[13px]">{conv.title}</span>
                        </button>
                        <div className="hidden group-hover:flex items-center pr-1.5 gap-0.5">
                          <button onClick={() => startRename(conv.id, conv.title)} className="p-1.5 rounded-lg hover:bg-background/50 transition-colors">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={() => deleteConversation(conv.id)} className="p-1.5 rounded-lg hover:bg-background/50 text-destructive transition-colors">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Bottom user section */}
              <div className="p-3 border-t border-sidebar-border">
                <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted/40 transition-colors cursor-default">
                  <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-primary">{userInitial}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{userName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/plans')}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2 mt-2 rounded-xl text-xs font-medium transition-colors ${
                    plan === 'pro'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-accent text-accent-foreground hover:bg-accent/80'
                  }`}
                >
                  <Crown className="h-3.5 w-3.5" />
                  {plan === 'pro' ? 'Plano Pro ✓' : 'Upgrade para Pro'}
                </button>

                <div className="flex items-center gap-1 mt-2">
                  <button
                    onClick={() => setSettingsOpen(true)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Configurações
                  </button>
                  <button
                    onClick={signOut}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Sair"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
