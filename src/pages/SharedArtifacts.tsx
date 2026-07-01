import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Check, Download, FileText, Code, FileArchive, File, FileCode, Loader2 } from 'lucide-react';
import JSZip from 'jszip';

interface Artifact {
  filename: string;
  type: string;
  title: string;
  content: string;
}

interface SharedData {
  title: string;
  artifacts: Artifact[];
  created_at: string;
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'html': case 'htm': return <Code className="h-4 w-4 text-primary shrink-0" />;
    case 'zip': case 'rar': return <FileArchive className="h-4 w-4 text-yellow-600 shrink-0" />;
    case 'js': case 'ts': case 'jsx': case 'tsx': case 'py': case 'java': case 'cpp':
      return <FileCode className="h-4 w-4 text-primary shrink-0" />;
    case 'md': case 'txt': return <FileText className="h-4 w-4 text-muted-foreground shrink-0" />;
    default: return <File className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
};

export default function SharedArtifacts() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<SharedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .rpc('get_shared_artifact', { p_id: id })
      .then(({ data: rows, error: err }) => {
        const row = Array.isArray(rows) ? rows[0] : rows;
        if (err || !row) {
          setError('Artefatos não encontrados ou link inválido.');
        } else {
          setData({
            title: row.title,
            artifacts: (row.artifacts as any) || [],
            created_at: row.created_at,
          });
        }
        setLoading(false);
      });
  }, [id]);

  const copyContent = (content: string, idx: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAll = async () => {
    if (!data) return;
    const zip = new JSZip();
    data.artifacts.forEach((a) => zip.file(a.filename, a.content));
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shared-artifacts-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">Link inválido</h1>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{data.title}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Compartilhado em {new Date(data.created_at).toLocaleDateString('pt-BR')}
          </p>
        </div>

        {data.artifacts.length > 1 && (
          <button
            onClick={downloadAll}
            className="flex items-center gap-2 px-4 py-2 mb-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <FileArchive className="h-4 w-4" />
            Baixar tudo (.zip)
          </button>
        )}

        <div className="space-y-3">
          {data.artifacts.map((artifact, idx) => (
            <div key={idx} className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                  {getFileIcon(artifact.filename)}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{artifact.title}</div>
                    <div className="text-[10px] text-muted-foreground">{artifact.filename} • {artifact.type}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => copyContent(artifact.content, idx)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-muted rounded-md text-xs hover:bg-muted/80 transition-colors"
                  >
                    {copiedIdx === idx ? <><Check className="h-3 w-3 text-green-500" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar</>}
                  </button>
                  <button
                    onClick={() => downloadFile(artifact.content, artifact.filename)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs hover:bg-primary/90 transition-colors"
                  >
                    <Download className="h-3 w-3" /> Baixar
                  </button>
                </div>
              </div>
              <pre className="p-4 overflow-x-auto text-xs text-foreground bg-muted/30 max-h-96">
                <code>{artifact.content}</code>
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
