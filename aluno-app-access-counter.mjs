function numeroSeguro(valor) {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? Math.max(0, Math.trunc(numero)) : 0;
}

export function combinarContadorAcessos({ central = 0, biometria = 0, limite = 3 } = {}) {
  const usadosCentral = numeroSeguro(central);
  const usadosBiometria = numeroSeguro(biometria);
  const usados = usadosCentral + usadosBiometria;
  const limiteNormalizado = numeroSeguro(limite);
  const restantes = limiteNormalizado > 0 ? Math.max(0, limiteNormalizado - usados) : null;
  return {
    limite: limiteNormalizado,
    usados,
    restantes,
    limiteAtingido: limiteNormalizado > 0 && usados >= limiteNormalizado,
    usadosCentral,
    usadosBiometria
  };
}
