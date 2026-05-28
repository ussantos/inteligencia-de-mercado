// Este arquivo busca dados de CNPJ em fontes publicas.
// Ele tenta mais de uma fonte porque APIs publicas podem sair do ar ou limitar chamadas.
// O resultado e normalizado para a aplicacao sempre receber o mesmo formato.
import { prisma } from '@/lib/prisma';
import { normalizeCnpj, validarCNPJ } from '@/lib/cnpj';
import { fetchWithTimeout } from '@/lib/fetch-timeout';
import type { CnaeOption, UnidadeNegocio } from '@/lib/types';

function normalizeText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeCep(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '').slice(0, 8);
}

function onlyDigits(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

function buildCnaes(principalCodigo: string, principalDescricao: string, secundarios: Array<{ codigo?: unknown; descricao?: unknown; text?: unknown; code?: unknown }>): CnaeOption[] {
  const cnaes: CnaeOption[] = [];
  if (principalCodigo || principalDescricao) {
    cnaes.push({ codigo: onlyDigits(principalCodigo), descricao: principalDescricao || 'CNAE principal não informado', tipo: 'Principal' });
  }
  for (const item of secundarios) {
    const codigo = onlyDigits(item.codigo ?? item.code);
    const descricao = normalizeText(item.descricao ?? item.text);
    if (!descricao) continue;
    const dedup = `${codigo}:${descricao}`;
    if (cnaes.some((cnae) => `${cnae.codigo}:${cnae.descricao}` === dedup)) continue;
    cnaes.push({ codigo, descricao, tipo: 'Secundário' });
  }
  return cnaes;
}

function mapBrasilApi(data: any, cnpj: string): UnidadeNegocio {
  const secundariosRaw = Array.isArray(data.cnaes_secundarios) ? data.cnaes_secundarios : [];
  const cnaePrincipalCodigo = normalizeText(data.cnae_fiscal) || '';
  const cnaePrincipalDescricao = normalizeText(data.cnae_fiscal_descricao) || 'CNAE não informado';
  const cnaes = buildCnaes(cnaePrincipalCodigo, cnaePrincipalDescricao, secundariosRaw);

  return {
    cnpj,
    razaoSocial: normalizeText(data.razao_social) || 'Razão social não informada',
    nomeFantasia: normalizeText(data.nome_fantasia),
    situacaoCadastral: normalizeText(data.descricao_situacao_cadastral || data.situacao_cadastral) || 'Não informada',
    cnaePrincipalCodigo,
    cnaePrincipalDescricao,
    cnaeSecundarios: cnaes.filter((cnae) => cnae.tipo === 'Secundário').map((cnae) => cnae.descricao),
    cnaes,
    logradouro: normalizeText(data.logradouro) || '',
    numero: normalizeText(data.numero) || '',
    complemento: normalizeText(data.complemento),
    bairro: normalizeText(data.bairro) || '',
    municipio: normalizeText(data.municipio) || '',
    uf: normalizeText(data.uf) || '',
    cep: normalizeCep(data.cep),
    telefone: normalizeText(data.ddd_telefone_1 || data.telefone),
    email: normalizeText(data.email),
    porte: normalizeText(data.porte),
    naturezaJuridica: normalizeText(data.natureza_juridica),
    capitalSocial: data.capital_social ? Number(data.capital_social) : null,
    dataAbertura: normalizeText(data.data_inicio_atividade || data.abertura)
  };
}

function mapReceitaWs(data: any, cnpj: string): UnidadeNegocio {
  const secundariosRaw = Array.isArray(data.atividades_secundarias) ? data.atividades_secundarias : [];
  const principal = Array.isArray(data.atividade_principal) ? data.atividade_principal[0] : null;
  const cnaePrincipalCodigo = normalizeText(principal?.code) || '';
  const cnaePrincipalDescricao = normalizeText(principal?.text) || 'CNAE não informado';
  const cnaes = buildCnaes(cnaePrincipalCodigo, cnaePrincipalDescricao, secundariosRaw);

  return {
    cnpj,
    razaoSocial: normalizeText(data.nome) || 'Razão social não informada',
    nomeFantasia: normalizeText(data.fantasia),
    situacaoCadastral: normalizeText(data.situacao) || 'Não informada',
    cnaePrincipalCodigo,
    cnaePrincipalDescricao,
    cnaeSecundarios: cnaes.filter((cnae) => cnae.tipo === 'Secundário').map((cnae) => cnae.descricao),
    cnaes,
    logradouro: normalizeText(data.logradouro) || '',
    numero: normalizeText(data.numero) || '',
    complemento: normalizeText(data.complemento),
    bairro: normalizeText(data.bairro) || '',
    municipio: normalizeText(data.municipio) || '',
    uf: normalizeText(data.uf) || '',
    cep: normalizeCep(data.cep),
    telefone: normalizeText(data.telefone),
    email: normalizeText(data.email),
    porte: normalizeText(data.porte),
    naturezaJuridica: normalizeText(data.natureza_juridica),
    capitalSocial: data.capital_social ? Number(String(data.capital_social).replace(/[^0-9,.]/g, '').replace(',', '.')) : null,
    dataAbertura: normalizeText(data.abertura)
  };
}

function mapOpenCnpj(data: any, cnpj: string): UnidadeNegocio {
  const secundariosRaw = Array.isArray(data.cnaes_secundarios) ? data.cnaes_secundarios : [];
  const cnaePrincipalCodigo = normalizeText(data.cnae_principal?.codigo || data.cnae_fiscal) || '';
  const cnaePrincipalDescricao = normalizeText(data.cnae_principal?.descricao || data.cnae_fiscal_descricao) || 'CNAE não informado';
  const cnaes = buildCnaes(cnaePrincipalCodigo, cnaePrincipalDescricao, secundariosRaw);

  return {
    cnpj,
    razaoSocial: normalizeText(data.razao_social || data.razaoSocial) || 'Razão social não informada',
    nomeFantasia: normalizeText(data.nome_fantasia || data.nomeFantasia),
    situacaoCadastral: normalizeText(data.situacao_cadastral || data.situacao) || 'Não informada',
    cnaePrincipalCodigo,
    cnaePrincipalDescricao,
    cnaeSecundarios: cnaes.filter((cnae) => cnae.tipo === 'Secundário').map((cnae) => cnae.descricao),
    cnaes,
    logradouro: normalizeText(data.logradouro) || '',
    numero: normalizeText(data.numero) || '',
    complemento: normalizeText(data.complemento),
    bairro: normalizeText(data.bairro) || '',
    municipio: normalizeText(data.municipio) || '',
    uf: normalizeText(data.uf) || '',
    cep: normalizeCep(data.cep),
    telefone: normalizeText(data.telefone),
    email: normalizeText(data.email),
    porte: normalizeText(data.porte),
    naturezaJuridica: normalizeText(data.natureza_juridica),
    capitalSocial: data.capital_social ? Number(data.capital_social) : null,
    dataAbertura: normalizeText(data.data_inicio_atividade || data.abertura)
  };
}

async function fetchJson(url: string, init?: RequestInit) {
  // Cada fonte publica recebe um tempo limite curto.
  // Se ela falhar, tentamos a proxima fonte em vez de travar a tela do usuario.
  const response = await fetchWithTimeout(url, { ...init, headers: { Accept: 'application/json', ...(init?.headers || {}) } }, 12000);
  if (!response.ok) throw new Error(`Fonte retornou HTTP ${response.status}`);
  return response.json();
}

export async function getCnpjData(input: string): Promise<UnidadeNegocio> {
  const cnpj = normalizeCnpj(input);
  if (!validarCNPJ(cnpj)) {
    throw new Error('CNPJ inválido. Verifique o número informado.');
  }

  const cached = await prisma.cnpjCache.findFirst({
    where: { cnpj, expiresAt: { gt: new Date() } }
  });

  if (cached) {
    const raw = cached.rawJson as any;
    return {
      cnpj,
      razaoSocial: cached.razaoSocial,
      nomeFantasia: cached.nomeFantasia,
      situacaoCadastral: raw.situacaoCadastral || raw.descricao_situacao_cadastral || raw.situacao || 'Não informada',
      cnaePrincipalCodigo: cached.cnaeCode,
      cnaePrincipalDescricao: cached.cnaeDesc,
      cnaeSecundarios: raw.cnaeSecundarios || raw.cnaes?.filter((x: any) => x.tipo === 'Secundário').map((x: any) => x.descricao).filter(Boolean) || raw.cnaes_secundarios?.map((x: any) => x.descricao).filter(Boolean) || [],
      cnaes: raw.cnaes || buildCnaes(cached.cnaeCode, cached.cnaeDesc, []),
      logradouro: cached.logradouro,
      numero: raw.numero || '',
      complemento: raw.complemento || null,
      bairro: cached.bairro,
      municipio: cached.municipio,
      uf: cached.uf,
      cep: cached.cep,
      telefone: raw.telefone || raw.ddd_telefone_1 || null,
      email: raw.email || null,
      porte: raw.porte || null,
      naturezaJuridica: raw.natureza_juridica || null,
      capitalSocial: raw.capital_social ? Number(raw.capital_social) : null,
      dataAbertura: raw.data_inicio_atividade || raw.abertura || null
    };
  }

  const errors: string[] = [];
  const sources = [
    {
      name: 'BrasilAPI',
      run: async () => mapBrasilApi(await fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`), cnpj)
    },
    {
      name: 'ReceitaWS',
      run: async () => mapReceitaWs(await fetchJson(`https://receitaws.com.br/v1/cnpj/${cnpj}`), cnpj)
    },
    {
      name: 'OpenCNPJ',
      run: async () => mapOpenCnpj(await fetchJson(`https://opencnpj.org/api/cnpj/${cnpj}`), cnpj)
    }
  ];

  for (const source of sources) {
    try {
      const unidade = await source.run();
      if (!unidade.cep || !unidade.bairro || !unidade.municipio) {
        throw new Error('Fonte retornou dados incompletos de endereço.');
      }
      await prisma.cnpjCache.upsert({
        where: { cnpj },
        update: {
          razaoSocial: unidade.razaoSocial,
          nomeFantasia: unidade.nomeFantasia,
          cnaeCode: unidade.cnaePrincipalCodigo,
          cnaeDesc: unidade.cnaePrincipalDescricao,
          cep: unidade.cep,
          logradouro: unidade.logradouro,
          bairro: unidade.bairro,
          municipio: unidade.municipio,
          uf: unidade.uf,
          rawJson: unidade as any,
          cachedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        create: {
          cnpj,
          razaoSocial: unidade.razaoSocial,
          nomeFantasia: unidade.nomeFantasia,
          cnaeCode: unidade.cnaePrincipalCodigo,
          cnaeDesc: unidade.cnaePrincipalDescricao,
          cep: unidade.cep,
          logradouro: unidade.logradouro,
          bairro: unidade.bairro,
          municipio: unidade.municipio,
          uf: unidade.uf,
          rawJson: unidade as any,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });
      return unidade;
    } catch (error) {
      errors.push(`${source.name}: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    }
  }

  throw new Error(`CNPJ não encontrado nas bases públicas. ${errors.join(' | ')}`);
}
