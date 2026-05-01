import jsPDF from 'jspdf';
import JSZip from 'jszip';

export async function generatePDF(content: string, title = 'Documento Vintel IA'): Promise<string> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let y = 30;

  // Header accent bar
  pdf.setFillColor(99, 102, 241); // indigo-500
  pdf.rect(0, 0, pageWidth, 4, 'F');

  // Title
  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 30, 30);
  const titleWrapped = pdf.splitTextToSize(title, contentWidth);
  pdf.text(titleWrapped, margin, y);
  y += titleWrapped.length * 10 + 4;

  // Subtitle line
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(140, 140, 140);
  pdf.text(`Gerado por Vintel IA • ${new Date().toLocaleDateString('pt-BR')}`, margin, y);
  y += 8;

  // Divider
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 10;

  pdf.setTextColor(40, 40, 40);
  const lines = content.split('\n');

  for (const line of lines) {
    if (y > pageHeight - 30) {
      pdf.addPage();
      pdf.setFillColor(99, 102, 241);
      pdf.rect(0, 0, pageWidth, 2, 'F');
      y = 20;
    }

    if (line.startsWith('# ')) {
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 30, 30);
      const text = line.replace('# ', '');
      const wrapped = pdf.splitTextToSize(text, contentWidth);
      y += 6;
      pdf.text(wrapped, margin, y);
      y += wrapped.length * 9 + 4;
    } else if (line.startsWith('## ')) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(60, 60, 60);
      const text = line.replace('## ', '');
      const wrapped = pdf.splitTextToSize(text, contentWidth);
      y += 5;
      pdf.text(wrapped, margin, y);
      y += wrapped.length * 7 + 3;
    } else if (line.startsWith('### ')) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(70, 70, 70);
      const text = line.replace('### ', '');
      const wrapped = pdf.splitTextToSize(text, contentWidth);
      y += 3;
      pdf.text(wrapped, margin, y);
      y += wrapped.length * 6 + 2;
    } else if (line.startsWith('> ')) {
      // Blockquote with left bar
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(100, 100, 100);
      const text = line.replace('> ', '');
      const wrapped = pdf.splitTextToSize(text, contentWidth - 10);
      pdf.setFillColor(99, 102, 241);
      pdf.rect(margin, y - 4, 1.5, wrapped.length * 5.5 + 2, 'F');
      pdf.text(wrapped, margin + 6, y);
      y += wrapped.length * 5.5 + 2;
      pdf.setTextColor(40, 40, 40);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(50, 50, 50);
      const text = line.replace(/^[-*]\s/, '').replace(/\*\*/g, '');
      const wrapped = pdf.splitTextToSize(text, contentWidth - 10);
      // Bullet circle
      pdf.setFillColor(99, 102, 241);
      pdf.circle(margin + 2, y - 1.2, 1, 'F');
      pdf.text(wrapped, margin + 7, y);
      y += wrapped.length * 5.5 + 1;
    } else if (/^\d+\.\s/.test(line)) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(50, 50, 50);
      const num = line.match(/^(\d+)\./)?.[1] || '';
      const text = line.replace(/^\d+\.\s/, '').replace(/\*\*/g, '');
      const wrapped = pdf.splitTextToSize(text, contentWidth - 10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(99, 102, 241);
      pdf.text(`${num}.`, margin, y);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(50, 50, 50);
      pdf.text(wrapped, margin + 7, y);
      y += wrapped.length * 5.5 + 1;
    } else if (line === '') {
      y += 3;
    } else {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(50, 50, 50);
      const text = line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '');
      const wrapped = pdf.splitTextToSize(text, contentWidth);
      pdf.text(wrapped, margin, y);
      y += wrapped.length * 5.5;
    }
  }

  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    // Footer
    pdf.setDrawColor(230, 230, 230);
    pdf.setLineWidth(0.2);
    pdf.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(160, 160, 160);
    pdf.text(`Vintel IA`, margin, pageHeight - 10);
    pdf.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  const blob = pdf.output('blob');
  return URL.createObjectURL(blob);
}

export function generateHTML(content: string, title = 'Documento Vintel IA'): string {
  const BOM = '\uFEFF';
  if (content.trim().toLowerCase().startsWith('<!doctype') || content.trim().toLowerCase().startsWith('<html')) {
    // Ensure charset meta exists
    let html = content;
    if (!/<meta\s+charset/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, '<head$1>\n  <meta charset="UTF-8">');
    }
    const blob = new Blob([BOM + html], { type: 'text/html;charset=utf-8' });
    return URL.createObjectURL(blob);
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background: #fafafa;
    }
    h1 { font-size: 2rem; margin-bottom: 1rem; color: #1a1a1a; }
    h2 { font-size: 1.5rem; margin: 1.5rem 0 0.75rem; color: #333; }
    h3 { font-size: 1.25rem; margin: 1.25rem 0 0.5rem; color: #444; }
    p { margin-bottom: 1rem; }
    ul, ol { margin: 1rem 0; padding-left: 2rem; }
    li { margin-bottom: 0.5rem; }
    code { background: #e8e8e8; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.9em; }
    pre { background: #1a1a1a; color: #f8f8f8; padding: 1rem; border-radius: 8px; overflow-x: auto; margin: 1rem 0; }
    pre code { background: none; color: inherit; padding: 0; }
    blockquote { border-left: 4px solid #6366f1; padding-left: 1rem; margin: 1rem 0; color: #555; }
    .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #ddd; font-size: 0.85rem; color: #888; text-align: center; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${markdownToHTML(content)}
  <div class="footer">Gerado por Vintel IA</div>
</body>
</html>`;

  const blob = new Blob([BOM + html], { type: 'text/html;charset=utf-8' });
  return URL.createObjectURL(blob);
}

function markdownToHTML(markdown: string): string {
  let html = markdown
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<')) return trimmed;
      return `<p>${trimmed}</p>`;
    })
    .join('\n');

  html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, '<ul>$&</ul>');

  return html;
}

export function generateTXT(content: string): string {
  const cleanText = content
    .replace(/^#{1,6}\s/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  const blob = new Blob([cleanText], { type: 'text/plain;charset=utf-8' });
  return URL.createObjectURL(blob);
}

export interface ZipFile {
  name: string;
  content: string;
}

export async function generateZIP(filesJson: string, projectName = 'projeto-vintel'): Promise<string> {
  const zip = new JSZip();

  try {
    const jsonMatch = filesJson.match(/\{[\s\S]*"files"[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSON de arquivos não encontrado na resposta');
    }

    const data = JSON.parse(jsonMatch[0]);
    const files: ZipFile[] = data.files || [];

    if (files.length === 0) {
      throw new Error('Nenhum arquivo encontrado no JSON');
    }

    for (const file of files) {
      if (file.name && file.content) {
        zip.file(file.name, file.content);
      }
    }

    if (!files.some(f => f.name.toLowerCase() === 'readme.md')) {
      zip.file('README.md', `# ${projectName}\n\nProjeto gerado por Vintel IA\n\n## Arquivos\n\n${files.map(f => `- ${f.name}`).join('\n')}`);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error('Erro ao gerar ZIP:', e);
    throw new Error('Não foi possível gerar o arquivo ZIP. Verifique o formato do conteúdo.');
  }
}

export function downloadFile(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
