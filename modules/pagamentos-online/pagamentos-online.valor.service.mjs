function numero(valor, fallback = 0) {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function centavos(valor) {
  return Math.max(0, Math.round(numero(valor, 0) * 100));
}

function reaisDeCentavos(valor) {
  return Number((Math.max(0, Number(valor) || 0) / 100).toFixed(2));
}

function descricao(valor = "", fallback = "Pagamento Fusion") {
  return (String(valor ?? "").trim() || fallback).slice(0, 120);
}

export function montarCheckoutMensalidadeOnline({
  descricaoPrincipal = "Mensalidade",
  saldoPrincipal = 0,
  multa = 0,
  juros = 0
} = {}) {
  const principalC = centavos(saldoPrincipal);
  const multaC = centavos(multa);
  const jurosC = centavos(juros);

  const itens = [];

  if (principalC > 0) {
    itens.push({
      quantity: 1,
      price: principalC,
      description: descricao(descricaoPrincipal, "Mensalidade")
    });
  }

  if (multaC > 0) {
    itens.push({
      quantity: 1,
      price: multaC,
      description: "Multa por atraso"
    });
  }

  if (jurosC > 0) {
    itens.push({
      quantity: 1,
      price: jurosC,
      description: "Juros por atraso"
    });
  }

  const totalCentavos = itens.reduce(
    (total, item) => total + (item.quantity * item.price),
    0
  );

  return {
    valor: reaisDeCentavos(totalCentavos),
    totalCentavos,
    saldoPrincipal: reaisDeCentavos(principalC),
    multa: reaisDeCentavos(multaC),
    juros: reaisDeCentavos(jurosC),
    itens
  };
}

export function checkoutAbertoCompativelComValor(
  registro = {},
  valorAtual = 0
) {
  return centavos(registro.valor) === centavos(valorAtual);
}

export function validarItensInfinitePay({
  itens = [],
  valor = 0,
  descricaoPadrao = "Pagamento Fusion"
} = {}) {
  const normalizados = (Array.isArray(itens) ? itens : [])
    .map((item) => ({
      quantity: Math.max(1, Math.trunc(numero(item?.quantity, 1))),
      price: Math.max(0, Math.trunc(numero(item?.price, 0))),
      description: descricao(item?.description, descricaoPadrao)
    }))
    .filter((item) => item.price > 0);

  if (!normalizados.length) {
    const totalC = centavos(valor);
    return totalC > 0
      ? [{
          quantity: 1,
          price: totalC,
          description: descricao(descricaoPadrao)
        }]
      : [];
  }

  const totalC = normalizados.reduce(
    (total, item) => total + (item.quantity * item.price),
    0
  );

  if (totalC !== centavos(valor)) {
    throw Object.assign(
      new Error("A composição do checkout diverge do valor devido."),
      {
        status: 500,
        code: "PAYMENT_CHECKOUT_ITEMS_VALUE_MISMATCH"
      }
    );
  }

  return normalizados;
}
