import { motion } from 'framer-motion';
import { agents } from '@/data/agents';
import { AgentType } from '@/types/agent';
import { useChatStore } from '@/store/chatStore';
import { cn } from '@/lib/utils';

const agentColorMap: Record<AgentType, string> = {
  research: 'border-agent-research/30 hover:border-agent-research/60 hover:shadow-[0_0_20px_hsl(200_80%_55%/0.1)]',
  coder: 'border-agent-coder/30 hover:border-agent-coder/60 hover:shadow-[0_0_20px_hsl(160_84%_50%/0.1)]',
  business: 'border-agent-business/30 hover:border-agent-business/60 hover:shadow-[0_0_20px_hsl(35_90%_55%/0.1)]',
  content: 'border-agent-content/30 hover:border-agent-content/60 hover:shadow-[0_0_20px_hsl(300_60%_60%/0.1)]',
  automation: 'border-agent-automation/30 hover:border-agent-automation/60 hover:shadow-[0_0_20px_hsl(220_70%_60%/0.1)]',
};

export function AgentSelector() {
  const { createConversation } = useChatStore();

  const handleSelect = (agentId: AgentType) => {
    createConversation(agentId);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-4xl mx-auto w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
          <span className="text-gradient-primary">NexusAI</span>
        </h1>
        <p className="text-muted-foreground text-lg">
          Escolha um agente especializado ou inicie uma conversa livre
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full mb-8">
        {agents.map((agent, i) => (
          <motion.button
            key={agent.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            onClick={() => handleSelect(agent.id)}
            className={cn(
              'group p-4 rounded-xl border bg-card text-left transition-all duration-300',
              agentColorMap[agent.id]
            )}
          >
            <div className="text-2xl mb-2">{agent.icon}</div>
            <h3 className="font-semibold text-foreground mb-1">{agent.name}</h3>
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{agent.description}</p>
            <div className="flex flex-wrap gap-1">
              {agent.capabilities.slice(0, 3).map((cap) => (
                <span key={cap} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {cap}
                </span>
              ))}
            </div>
          </motion.button>
        ))}
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        onClick={() => createConversation()}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ou iniciar conversa sem agente específico →
      </motion.button>
    </div>
  );
}
