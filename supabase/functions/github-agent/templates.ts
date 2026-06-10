// File templates injected by the GitHub agent when opening standardization PRs.

export const PLAN_ISSUE_TITLE = "Plano de Organização";

export const planIssueBody = (repo: string) => `# Plano de Organização — \`${repo}\`

Checklist sugerido para deixar o repositório em conformidade com o padrão pessoal.

- [ ] Descrição e tópicos preenchidos no GitHub
- [ ] README.md padrão (com seções: Sobre, Stack, Como rodar, Licença)
- [ ] LICENSE (MIT)
- [ ] .editorconfig
- [ ] .gitignore adequado à stack
- [ ] ESLint + Prettier (se for JS/TS)
- [ ] GitHub Actions: lint / test / build
- [ ] Dependabot (\`.github/dependabot.yml\`)
- [ ] Avaliar como candidato a **arquivar** ou **unificar** com repos similares

> Issue criada automaticamente pelo **Vintel IA · Agente GitHub**. Reversível em até 48h pelo comando "Reverter".`;

export const README_TEMPLATE = (repo: string) => `# ${repo}

> Descrição curta do projeto.

## Stack

- (preencha aqui)

## Como rodar

\`\`\`bash
# instalar
# rodar
\`\`\`

## Licença

MIT © rian72891
`;

export const LICENSE_MIT = (year: number, holder: string) => `MIT License

Copyright (c) ${year} ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

export const LICENSE_APACHE2 = (year: number, holder: string) =>
  `Copyright ${year} ${holder}

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
`;

export const EDITORCONFIG = `root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
`;

export const GITIGNORE = `# deps
node_modules/
.pnp
.pnp.js

# build
dist/
build/
out/
.next/
.vite/

# env
.env
.env.*
!.env.example

# logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# editors
.vscode/
.idea/
.DS_Store
`;

export const ESLINT_CONFIG = `import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
`;

export const PRETTIER_CONFIG = `{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100
}
`;

export const GH_ACTIONS_CI = `name: CI

on:
  push:
    branches: [main, master]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci || npm install
      - run: npm run lint --if-present
      - run: npm test --if-present
      - run: npm run build --if-present
`;

export const DEPENDABOT = `version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
`;

export const ISSUE_TEMPLATE_BUG = `---
name: Bug report
about: Reportar um problema
labels: bug
---

**Descrição**

**Passos para reproduzir**
1.

**Esperado**

**Atual**
`;

export const PR_TEMPLATE = `## Mudança

## Checklist
- [ ] Lint passa
- [ ] Testes passam
- [ ] Documentação atualizada
`;

export function profileReadme(opts: {
  username: string;
  repos: Array<{ name: string; description: string | null; html_url: string }>;
}) {
  const { username, repos } = opts;
  const sorted = [...repos].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  const grouped = new Map<string, typeof sorted>();
  for (const r of sorted) {
    const k = r.name[0]?.toUpperCase() ?? "#";
    const key = /[A-Z]/.test(k) ? k : "#";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }
  const letters = Array.from(grouped.keys()).sort();
  let body = `# Olá, sou @${username} 👋\n\n`;
  body += `> Perfil mantido automaticamente pelo **Vintel IA · Agente GitHub**.\n\n`;
  body += `## 📅 Workflow diário\n\n`;
  body += `- **Manhã** — revisar issues abertas, escolher 1 foco do dia\n`;
  body += `- **Tarde** — codar o foco, commits pequenos e descritivos\n`;
  body += `- **Fim do dia** — abrir PR / mergear, atualizar README do projeto\n\n`;
  body += `## 📚 Índice A–Z dos repositórios\n\n`;
  for (const L of letters) {
    body += `### ${L}\n\n`;
    for (const r of grouped.get(L)!) {
      const desc = r.description ? ` — ${r.description}` : "";
      body += `- [${r.name}](${r.html_url})${desc}\n`;
    }
    body += `\n`;
  }
  body += `---\n\n_Atualizado em ${new Date().toISOString().slice(0, 10)}_\n`;
  return body;
}
