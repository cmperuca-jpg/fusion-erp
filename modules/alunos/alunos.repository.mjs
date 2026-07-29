import crypto from "crypto";
import { lerJsonDuravel, salvarJsonDuravel, executarTransacaoJson } from "../core/persistence/durable-json.mjs";

async function lerAlunos() {
  try {
    const dados = await lerJsonDuravel("alunos.json", []);
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

async function salvarAlunos(alunos) {
  await salvarJsonDuravel("alunos.json", alunos);
}

function limparCpf(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function cpfValido(valor) {
  const cpf = limparCpf(valor);
  if (!cpf) return true;
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calcularDigito = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i += 1) {
      soma += Number(base[i]) * (base.length + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcularDigito(cpf.slice(0, 9)) === Number(cpf[9]) &&
    calcularDigito(cpf.slice(0, 10)) === Number(cpf[10]);
}

function validarCpfCadastro(cpf) {
  if (cpf && !cpfValido(cpf)) {
    throw new Error("CPF invalido. Confira os numeros digitados.");
  }
}

function sincronizarSenhaAcessoAluno(dados = {}) {
  const senha = dados.senhaAluno || dados.senhaAcesso || dados.senhaPortal || dados.portalSenha || dados.senha || "";
  if (!senha) return dados;
  return {
    ...dados,
    senhaAluno: String(senha),
    senhaAcesso: String(senha),
    senhaPortal: String(senha),
    portalSenha: String(senha)
  };
}

export async function listarAlunos() {
  return await lerAlunos();
}

export async function buscarAlunoPorId(id) {
  const alunos = await lerAlunos();
  return alunos.find(aluno => String(aluno.id) === String(id));
}

async function criarAlunoInterno(aluno) {
  const alunos = await lerAlunos();
  const cpfNovo = limparCpf(aluno.cpf);
  validarCpfCadastro(cpfNovo);

  if (cpfNovo) {
    const cpfJaExiste = alunos.some(item => limparCpf(item.cpf) === cpfNovo);

    if (cpfJaExiste) {
      throw new Error("Já existe um aluno cadastrado com este CPF.");
    }
  }

  const dadosAluno = sincronizarSenhaAcessoAluno(aluno);
  const novoAluno = {
    id: crypto.randomUUID(),
    status: dadosAluno.status || "inativo",
    criado_em: new Date().toISOString(),
    ...dadosAluno,
    cpf: cpfNovo || dadosAluno.cpf || ""
  };

  alunos.push(novoAluno);
  await salvarAlunos(alunos);

  return novoAluno;
}
export async function criarAluno(aluno) {
  return executarTransacaoJson(() => criarAlunoInterno(aluno), { operacaoId: `aluno-criar-${crypto.randomUUID()}` });
}

async function atualizarAlunoInterno(id, dados) {
  const alunos = await lerAlunos();
  const index = alunos.findIndex(aluno => String(aluno.id) === String(id));

  if (index === -1) {
    return null;
  }

  const cpfNovo = limparCpf(dados.cpf);
  validarCpfCadastro(cpfNovo);

  if (cpfNovo) {
    const cpfJaExiste = alunos.some((item, itemIndex) =>
      itemIndex !== index && limparCpf(item.cpf) === cpfNovo
    );

    if (cpfJaExiste) {
      throw new Error("Já existe outro aluno cadastrado com este CPF.");
    }
  }

  const dadosAluno = sincronizarSenhaAcessoAluno(dados);
  alunos[index] = {
    ...alunos[index],
    ...dadosAluno,
    cpf: cpfNovo || dadosAluno.cpf || alunos[index].cpf || "",
    atualizado_em: new Date().toISOString()
  };

  await salvarAlunos(alunos);

  return alunos[index];
}
export async function atualizarAluno(id, dados) {
  return executarTransacaoJson(() => atualizarAlunoInterno(id, dados), { operacaoId: `aluno-atualizar-${id}-${Date.now()}` });
}

async function excluirAlunoInterno(id) {
  const alunos = await lerAlunos();
  const filtrados = alunos.filter(aluno => String(aluno.id) !== String(id));

  await salvarAlunos(filtrados);

  return alunos.length !== filtrados.length;
}
export async function excluirAluno(id) {
  return executarTransacaoJson(() => excluirAlunoInterno(id), { operacaoId: `aluno-excluir-${id}-${Date.now()}` });
}
