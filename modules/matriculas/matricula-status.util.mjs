export function normalizarStatusMatricula(valor) {
  return String(valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function statusMatriculaEh(valor, statusEsperados = []) {
  const atual = normalizarStatusMatricula(valor);
  return statusEsperados.some(status => normalizarStatusMatricula(status) === atual);
}

export function matriculaEstaAtiva(matriculaOuStatus = {}) {
  const status = typeof matriculaOuStatus === "object"
    ? matriculaOuStatus?.status ?? matriculaOuStatus?.situacao ?? matriculaOuStatus?.statusMatricula
    : matriculaOuStatus;

  return statusMatriculaEh(status, ["ativa", "ativo", "active"]);
}

// Preserva a regra comercial existente: matrícula ativa, pendente ou trancada
// impede a criação de outra matrícula para o mesmo aluno.
export function matriculaBloqueiaNovaMatricula(matriculaOuStatus = {}) {
  const status = typeof matriculaOuStatus === "object"
    ? matriculaOuStatus?.status ?? matriculaOuStatus?.situacao ?? matriculaOuStatus?.statusMatricula
    : matriculaOuStatus;

  return statusMatriculaEh(status, [
    "ativa", "ativo", "active",
    "pendente", "pending",
    "trancada", "trancado", "suspensa", "suspenso"
  ]);
}
