import fs from "node:fs/promises";
import path from "node:path";

const DATA = path.resolve(process.cwd(), "data");
const alunosFile = path.join(DATA, "alunos.json");
const profFile = path.join(DATA, "professores.json");

function norm(v){ return String(v||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
async function ler(file, padrao=[]){ try { const txt = await fs.readFile(file, "utf8"); return txt.trim() ? JSON.parse(txt) : padrao; } catch { return padrao; } }
async function salvar(file, dados){ await fs.mkdir(path.dirname(file), { recursive:true }); await fs.writeFile(file, JSON.stringify(dados, null, 2), "utf8"); }
function idProf(p){ return String(p.id || p._id || p.codigo || p.nome || ""); }
function nomeProf(p){ return String(p.nome || p.name || "").trim(); }

const alunos = await ler(alunosFile, []);
const professores = await ler(profFile, []);
let alterados = 0;

for (const aluno of alunos) {
  const atualId = String(aluno.professorId || aluno.professor_id || "").trim();
  let prof = null;

  if (atualId) prof = professores.find(p => idProf(p) === atualId);

  if (!prof) {
    const texto = norm(aluno.professor_responsavel || aluno.professorResponsavel || aluno.professorNome || aluno.professor_nome || aluno.professor || "");
    if (texto) {
      prof = professores.find(p =>
        norm(idProf(p)) === texto ||
        norm(nomeProf(p)) === texto ||
        (p.cref && norm(p.cref) === texto)
      );
    }
  }

  if (prof) {
    const novoId = idProf(prof);
    const novoNome = nomeProf(prof);
    if (aluno.professorId !== novoId || aluno.professorNome !== novoNome || aluno.professor_responsavel !== novoNome) {
      aluno.professorId = novoId;
      aluno.professor_id = novoId;
      aluno.professorNome = novoNome;
      aluno.professor_nome = novoNome;
      aluno.professor_responsavel = novoNome;
      aluno.atualizado_em = new Date().toISOString();
      alterados++;
    }
  }
}

await salvar(alunosFile, alunos);
console.log("Correção de vínculo professor-aluno concluída:");
console.log(JSON.stringify({ alunosAtualizados: alterados, totalAlunos: alunos.length, professores: professores.length }, null, 2));
