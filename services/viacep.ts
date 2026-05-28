// Este arquivo chama o ViaCEP.
// ViaCEP transforma um CEP brasileiro em endereco, bairro, cidade e estado.
import { normalizeCep } from '@/lib/cep';
import { fetchWithTimeout } from '@/lib/fetch-timeout';

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

  try {
    const response = await fetchWithTimeout(`https://viacep.com.br/ws/${normalized}/json/`, {
      next: { revalidate: 60 * 60 * 24 }
    }, 8000);

    if (!response.ok) return null;
    const data = (await response.json()) as ViaCepResponse;
    if (data.erro) return null;
    return data;
  } catch {
    return null;
  }
}
