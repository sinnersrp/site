const META_SEMANAL = 100000;

function calcularMetaSemanal(total = 0) {
  const valorTotal = Number(total) || 0;
  const valorFamilia = Math.min(valorTotal, META_SEMANAL);
  const excedente = Math.max(valorTotal - META_SEMANAL, 0);
  const valorLimpo = Math.floor(excedente * 0.5);
  const faltante = Math.max(META_SEMANAL - valorTotal, 0);

  return {
    metaSemanal: META_SEMANAL,
    valorTotal,
    valorFamilia,
    excedente,
    valorLimpo,
    faltante,
    bateuMeta: valorTotal >= META_SEMANAL
  };
}

module.exports = {
  META_SEMANAL,
  calcularMetaSemanal
};
