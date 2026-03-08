import { motion } from 'framer-motion';
import { Message } from '@/types/agent';
import { cn } from '@/lib/utils';
import { Bot, User, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useState } from 'react';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);

  const copyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedBlock(idx);
    setTimeout(() => setCopiedBlock(null), 2000);
  };

  let codeBlockIdx = 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('flex gap-3 px-4 py-3 max-w-4xl mx-auto', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-card border border-border text-foreground rounded-bl-md'
        )}
      >
        {/* Attachments */}
        {message.attachments?.map((att, i) => (
          <div key={i} className="mb-2">
            {att.type === 'image' ? (
              <img src={att.url} alt={att.name} className="rounded-lg max-h-64 object-contain" />
            ) : (
              <a href={att.url} download={att.name} className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-xs hover:bg-muted/80 transition-colors">
                <Download className="h-3.5 w-3.5" />
                <span className="truncate">{att.name}</span>
              </a>
            )}
          </div>
        ))}

        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0">
            <ReactMarkdown
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const isBlock = match || (typeof children === 'string' && children.includes('\n'));

                  if (isBlock) {
                    const currentIdx = codeBlockIdx++;
                    const codeStr = String(children).replace(/\n$/, '');
                    return (
                      <div className="relative group my-2 rounded-lg overflow-hidden border border-border">
                        <div className="flex items-center justify-between bg-muted px-3 py-1.5 text-[11px] text-muted-foreground">
                          <span>{match?.[1] || 'code'}</span>
                          <button
                            onClick={() => copyCode(codeStr, currentIdx)}
                            className="text-[10px] hover:text-foreground transition-colors"
                          >
                            {copiedBlock === currentIdx ? 'Copiado!' : 'Copiar'}
                          </button>
                        </div>
                        <pre className="p-3 overflow-x-auto bg-background text-xs leading-relaxed">
                          <code className={className} {...props}>{children}</code>
                        </pre>
                      </div>
                    );
                  }

                  return (
                    <code className="px-1.5 py-0.5 bg-muted rounded text-xs text-foreground" {...props}>
                      {children}
                    </code>
                  );
                },
                img({ src, alt }) {
                  return (
                    <div className="my-2">
                      <img src={src} alt={alt || ''} className="rounded-lg max-h-80 object-contain" />
                    </div>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
      {isUser && (
        <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </motion.div>
  );
}
