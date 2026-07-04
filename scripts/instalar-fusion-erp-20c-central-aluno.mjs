import fs from 'fs/promises';
import path from 'path';

const ROOT = process.cwd();
const BACKUP = path.join(ROOT, 'backup_legado', 'fusion_erp_20c_central_aluno_fix');

async function existe(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function backupArquivo(absPath) {
  if (!(await existe(absPath))) return;
  const rel = path.relative(ROOT, absPath);
  const dst = path.join(BACKUP, rel);
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await fs.copyFile(absPath, dst);
}

async function garantirArquivoAtivo(rel) {
  const abs = path.join(ROOT, rel);
  if (await existe(abs)) {
    console.log('OK      ', rel);
    return true;
  }
  console.log('FALTANDO', rel);
  return false;
}

function inserirAntesDeBody(html, trecho) {
  if (html.includes(trecho)) return html;
  return html.includes('</body>') ? html.replace('</body>', `  ${trecho}\n</body>`) : `${html}\n${trecho}\n`;
}

async function patchProntuario() {
  const htmlPath = path.join(ROOT, 'public', 'pages', 'alunos', 'prontuario.html');
  if (!(await existe(htmlPath))) {
    console.log('ERRO    public/pages/alunos/prontuario.html não encontrado.');
    process.exitCode = 1;
    return;
  }

  await backupArquivo(htmlPath);
  let html = await fs.readFile(htmlPath, 'utf8');

  if (!html.includes('central-comercial.css')) {
    html = html.replace('</head>', '  <link rel="stylesheet" href="./central-comercial.css">\n</head>');
  }

  if (!html.includes('/js/alunos/central-comercial.js')) {
    if (html.includes('<script src="./prontuario.js"></script>')) {
      html = html.replace(
        '<script src="./prontuario.js"></script>',
        '<script src="./prontuario.js"></script>\n  <script src="/js/alunos/central-comercial.js"></script>'
      );
    } else {
      html = inserirAntesDeBody(html, '<script src="/js/alunos/central-comercial.js"></script>');
    }
  }

  if (!html.includes('data-tab="contrato-comercial"')) {
    if (html.includes('<button class="tab" data-tab="matriculas">Matrículas</button>')) {
      html = html.replace(
        '<button class="tab" data-tab="matriculas">Matrículas</button>',
        '<button class="tab" data-tab="matriculas">Matrículas</button>\n          <button class="tab" data-tab="contrato-comercial">Contrato Comercial</button>\n          <button class="tab" data-tab="servicos-contratados">Serviços Contratados</button>'
      );
    } else if (html.includes('<div class="prontuario-tabs')) {
      html = html.replace(
        '</div>\n\n        <div class="tab-panel active" id="tab-resumo">',
        '          <button class="tab" data-tab="contrato-comercial">Contrato Comercial</button>\n          <button class="tab" data-tab="servicos-contratados">Serviços Contratados</button>\n        </div>\n\n        <div class="tab-panel active" id="tab-resumo">'
      );
    }
  }

  if (!html.includes('id="tab-contrato-comercial"')) {
    const bloco = `
        <div class="tab-panel" id="tab-contrato-comercial">
          <div class="fusion-card comercial-card">
            <h3>Contrato Comercial</h3>
            <div id="contratoComercialResumo" class="info-grid"></div>
          </div>
        </div>

        <div class="tab-panel" id="tab-servicos-contratados">
          <div class="fusion-card comercial-card">
            <div class="comercial-head">
              <h3>Serviços Contratados</h3>
              <button class="fusion-button" id="btnSalvarChecklistComercial" type="button">Salvar contrato</button>
            </div>
            <div id="servicosChecklist" class="servicos-checklist">Carregando...</div>
            <div id="contratoTotalBox" class="contrato-total-box"></div>
          </div>
        </div>
`;

    if (html.includes('<div class="tab-panel" id="tab-avaliacoes">')) {
      html = html.replace('<div class="tab-panel" id="tab-avaliacoes">', `${bloco}\n        <div class="tab-panel" id="tab-avaliacoes">`);
    } else if (html.includes('</section>')) {
      html = html.replace('</section>', `${bloco}\n      </section>`);
    } else {
      html += bloco;
    }
  }

  await fs.writeFile(htmlPath, html, 'utf8');
  console.log('PATCH   public/pages/alunos/prontuario.html');
}

await garantirArquivoAtivo('modules/comercial/comercial.service.mjs');
await garantirArquivoAtivo('modules/comercial/comercial.routes.mjs');
await garantirArquivoAtivo('public/js/alunos/central-comercial.js');
await garantirArquivoAtivo('public/pages/alunos/central-comercial.css');
await patchProntuario();

console.log('Fusion ERP 2.0-C: patch da Central do Aluno concluído.');
