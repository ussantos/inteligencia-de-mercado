import { normalizeCep } from '@/lib/cep';

export interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export async function getViaCep(cep: string): Promise<ViaCepResponse | null> {
  const normalized = normalizeCep(cep);
  if (normalized.length !== 8) return null;

  const response = await fetch(`https://viacep.com.br/ws/${normalized}/json/`, {
    next: { revalidate: 60 * 60 * 24 }
  });

  if (!response.ok) return null;
  const data = (await response.json()) as ViaCepResponse;
  if (data.erro) return null;
  return data;
}
