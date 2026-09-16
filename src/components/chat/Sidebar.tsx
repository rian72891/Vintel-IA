import { useState, useEffect } from 'react';
import { Plus, MessageSquare, X, Trash2, Pencil, Check, Settings, LogOut, Menu, Search, Plug, ListTodo } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '@/store/chatStore';
import { cn } from '@/lib/utils';
import { SettingsDialog } from './SettingsDialog';
import { useAuth } from '@/hooks/useAuth';
import { useProfileAvatar } from '@/hooks/useProfileAvatar';
import { PlanBadge } from '@/components/PlanBadge';
import { UsageBar } from '@/components/UsageBar';

export function Sidebar() {
  const { conversations, activeConversationId, sidebarOpen, setSidebarOpen, setActiveConversation, setSelectedAgent, deleteConversation, renameConversation, loadConversations, loaded } = useChatStore();
  const { user, signOut } = useAuth();
  const { avatarUrl } = useProfileAvatar(user);
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

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
  const userInitial = user?.user_metadata?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || '?';

  const navLinks = [
    { label: 'Novo bate-papo', icon: Plus, onClick: handleNewChat },
    { label: 'Conversas', icon: MessageSquare, onClick: () => {} },
    { label: 'Conectores', icon: Plug, onClick: () => navigate('/conectores') },
    { label: 'Minhas tarefas', icon: ListTodo, onClick: () => navigate('/minhas-tarefas') },
  ];

  return (
    <>
      {sidebarOpen && (
        <>
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
          />

          <aside className="fixed md:relative z-50 h-screen w-[280px] flex flex-col bg-sidebar">
            {/* Header fixo */}
            <div className="shrink-0 px-4 pt-4 pb-2 flex items-center justify-between">
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="Fechar menu lateral"
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors touch-feedback"
              >
                <Menu className="h-5 w-5" />
              </button>
              <button
                onClick={() => setSettingsOpen(true)}
                aria-label="Abrir configurações"
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors touch-feedback"
                title="Configurações"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>

            {/* Nav links fixos */}
            <div className="shrink-0 px-2 pt-1 pb-2 space-y-0.5">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={link.onClick}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/5 text-sm transition-colors touch-feedback"
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </button>
              ))}
            </div>

            {/* Search fixo */}
            <div className="shrink-0 px-3 pb-2 pt-1">
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

            {/* Lista de conversas — ocupa espaço restante com scroll */}
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-2 py-1 space-y-0.5">
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
                    'group flex items-center gap-1 rounded-xl text-sm transition-colors duration-100',
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
                      <button aria-label="Confirmar renomeação" onClick={confirmRename} className="p-1 text-primary hover:bg-muted rounded touch-feedback"><Check className="h-3 w-3" /></button>
                      <button aria-label="Cancelar renomeação" onClick={() => setEditingId(null)} className="p-1 text-muted-foreground hover:bg-muted rounded touch-feedback"><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setActiveConversation(conv.id)}
                        className="flex-1 px-3 py-2.5 text-left truncate touch-feedback"
                      >
                        <span className="truncate text-[13px]">{conv.title}</span>
                      </button>
                      <div className="hidden group-hover:flex items-center pr-1.5 gap-0.5">
                        <button aria-label={`Renomear conversa ${conv.title}`} onClick={() => startRename(conv.id, conv.title)} className="p-1.5 rounded-lg hover:bg-background/50 transition-colors touch-feedback">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button aria-label={`Excluir conversa ${conv.title}`} onClick={() => deleteConversation(conv.id)} className="p-1.5 rounded-lg hover:bg-background/50 text-destructive transition-colors touch-feedback">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Rodapé SEMPRE visível */}
            <div className="shrink-0 p-3 border-t border-sidebar-border space-y-2">
              <div className="space-y-1.5 px-1">
                <UsageBar type="messages" label="Mensagens hoje" />
                <UsageBar type="images" label="Imagens/mês" />
              </div>

              <PlanBadge />

              {/* User card sem engrenagem */}
              <div className="flex items-center gap-2 px-2 py-2 rounded-xl bg-muted/30">
                <div className="h-9 w-9 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={`Foto de ${userName}`} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-primary">{userInitial}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{userName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                </div>
                <button
                  onClick={signOut}
                  aria-label="Sair da conta"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors touch-feedback"
                  title="Sair"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
