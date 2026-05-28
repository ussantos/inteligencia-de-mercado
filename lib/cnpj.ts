// Este arquivo cuida de CNPJ.
// Ele remove pontuacao e valida os digitos verificadores, que funcionam como uma prova matematica de que o CNPJ pode existir.
export function normalizeCnpj(cnpj: string) {
  return cnpj.replace(/\D/g, '').slice(0, 14);
}

export function validarCNPJ(cnpj: string): boolean {
  const numeros = normalizeCnpj(cnpj);
  if (numeros.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(numeros)) return false;

  const calcularDigito = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((acc, digit, index) => acc + Number(digit) * pesos[index], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const d1 = calcularDigito(numeros.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcularDigito(numeros.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return numeros.endsWith(`${d1}${d2}`);
}
