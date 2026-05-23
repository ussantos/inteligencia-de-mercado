export function normalizeCep(cep: string) {
  return cep.replace(/\D/g, '').slice(0, 8);
}

export function isValidCep(cep: string) {
  return /^\d{8}$/.test(normalizeCep(cep));
}

export function detectCepColumn(headers: string[]) {
  const candidates = headers.map((header, index) => ({ header: header.toLowerCase().trim(), index }));
  return candidates.find(({ header }) => ['cep', 'ceps', 'codigo postal', 'código postal', 'postal code'].includes(header))?.index ?? -1;
}
