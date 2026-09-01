/**
 * 🎩 Cálculo del Dígito de Verificación (DV) - DIAN Colombia
 * Algoritmo Módulo 11 con primos: 71,67,59,53,47,43,41,37,29,23,19,17,13,7,3
 * @param {string|number} nit - Número de identificación (NIT o Cédula)
 * @returns {string} Dígito de verificación (0-9)
 */
export function calcularDV(nit) {
  if (!nit) return "";
  const str = String(nit).replace(/\D/g, "");
  if (!str) return "";

  const primos = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3];
  const padded = str.padStart(15, "0");

  let suma = 0;
  for (let i = 0; i < 15; i++) {
    suma += parseInt(padded[i], 10) * primos[i];
  }

  const residuo = suma % 11;
  if (residuo === 0) return "0";
  if (residuo === 1) return "1";
  return String(11 - residuo);
}
