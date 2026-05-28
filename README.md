# Inteligencia de Mercado

Aplicacao independente para analise regional de concorrencia, oportunidades, barreiras comerciais e posicionamento para qualquer tipo de negocio.

O projeto foi preparado para rodar como um **Azure Static Web App** proprio, sem dependencia de qualquer site ou dominio externo especifico.

## Proposito

A ferramenta ajuda empresas a transformar dados publicos e dados operacionais simples em um relatorio pratico de inteligencia de mercado. A analise parte do CNPJ da unidade, identifica endereco e CNAEs, cruza a regiao com concorrentes do Google Places, aceita uma planilha opcional de CEPs de clientes e gera recomendacoes para marketing, vendas, posicionamento e expansao local.

## Escopo atual

- Consulta de unidade por CNPJ usando fontes publicas.
- Lista automatica de CNAEs para orientar a analise.
- Selecao de tipos de concorrentes e alternativas de mercado.
- Campo de raio de analise da unidade, com padrao de 8 km.
- Upload opcional de CSV/XLSX com CEPs de clientes atuais.
- Validacao e normalizacao de CEPs.
- Geocodificacao com LocationIQ Free e fallback Nominatim.
- Mapa Leaflet + OpenStreetMap apenas para visualizacao.
- Busca de concorrentes com Google Places API, incluindo estrelas e quantidade de avaliacoes.
- Analise de afinidade por bairro/regiao, barreiras de conversao e posicionamento da unidade.
- Personas genericas por perfil de compra.
- Exportacao PDF client-side com jsPDF/html2canvas.
- Exportacao XLSX com SheetJS.
- Historico e compartilhamento de analises.
- Clerk Auth para proteger `/internal/*`.

## Observacao sobre Google Places

Para buscar concorrentes na regiao, configure uma chave server-side:

```env
GOOGLE_PLACES_API_KEY=
GOOGLE_PLACES_MAX_SEARCHES_PER_ANALYSIS=24
```

A API Places precisa estar habilitada no Google Cloud e a conta precisa ter billing ativo. Configure cotas baixas para testes.

O projeto nao grava cache vazio quando a chave do Google esta ausente. Assim, depois que a chave for configurada, a proxima analise chama o Google Places de verdade.

## Rodar localmente

```powershell
npm install
Copy-Item .env.example .env.local
notepad .env.local
npx prisma generate
npx prisma migrate dev --name init
npm run typecheck
npm run build
npm run dev
```

Acesse:

```text
http://localhost:3000/internal/market-intelligence
```

## Variaveis principais

Veja `.env.example`. Nunca commite `.env`, `.env.local`, tokens, connection strings ou URLs de banco com senha.

Principais variaveis:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL`
- `AZURE_STORAGE_CONNECTION_STRING`
- `AZURE_STORAGE_CONTAINER_NAME`
- `GOOGLE_PLACES_API_KEY`
- `GOOGLE_PLACES_MAX_SEARCHES_PER_ANALYSIS`
- `LOCATIONIQ_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

## Deploy no Azure Static Web Apps

Fluxo recomendado:

```text
GitHub -> GitHub Actions -> Azure Static Web Apps
```

Configuracao do workflow:

```yaml
app_location: /
api_location: ""
output_location: ""
app_build_command: "npm run build"
```

Nome sugerido do recurso:

```text
inteligencia-de-mercado
```

Regiao sugerida:

```text
Brazil South
```

As variaveis de ambiente sensiveis devem ser configuradas nas configuracoes do Azure Static Web Apps ou nos secrets do GitHub Actions, nao no repositorio.

## Limitacoes metodologicas

- Google Places depende de chave, billing ativo, cotas, APIs habilitadas e disponibilidade de dados locais.
- ViaCEP nao traz renda.
- IBGE Localidades identifica municipio/UF, mas nao renda por bairro.
- SIDRA exige tabela, variavel, periodo, classificacao e nivel territorial.
- PNAD e amostral e normalmente nao oferece granularidade por bairro/CEP.
- Censo 2022 pode enriquecer a analise, mas exige ETL com setor censitario, malha territorial e cruzamento geografico.

Os indicadores economicos iniciais sao estimativas operacionais para apoio a decisao, nao estatistica censitaria precisa por CEP.

## Prisma

Este projeto usa **Prisma 6.19.3** fixado em `package.json` e `package-lock.json`.

Nao atualize para Prisma 7 sem adaptar o projeto para o novo formato com `prisma.config.ts`. No Prisma 7, `url = env("DATABASE_URL")` dentro de `schema.prisma` deixa de ser aceito.
