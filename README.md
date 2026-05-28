# Inteligencia de Mercado

Aplicacao web independente para analise regional de concorrencia, oportunidades, barreiras comerciais e posicionamento para qualquer tipo de empresa.

A aplicacao esta preparada para rodar em Azure Static Web Apps, conectada a um repositorio GitHub privado ou publico configurado no ambiente de deploy.

Você pode testar a aplicação nesta URL: https://gray-glacier-0dc52610f.7.azurestaticapps.net/sign-in

## Proposito

A ferramenta transforma dados publicos e dados operacionais simples em um relatorio pratico de inteligencia de mercado. A analise parte do CNPJ da empresa, identifica endereco e CNAEs, cruza a regiao com locais do Google Places, aceita uma planilha opcional de CEPs de clientes e gera recomendacoes para marketing, vendas, posicionamento e expansao local.

## Funcionalidades

- Consulta de empresa por CNPJ usando fontes publicas, com cache em Postgres.
- Identificacao automatica de endereco, CEP e CNAEs.
- Selecao de CNAEs e tipos de concorrentes/alternativas de mercado.
- Analise por raio em torno do empreendimento, com padrao de 8 km.
- Upload opcional de CSV/XLSX com CEPs de clientes.
- Modelo CSV baixavel para preencher CEPs antes do upload.
- Normalizacao e validacao de CEPs.
- Geocodificacao com LocationIQ e fallback Nominatim.
- Distancia por linha reta e, quando configurado, rota com OpenRouteService.
- Busca de concorrentes e locais relevantes via Google Places API.
- Mapa Leaflet com OpenStreetMap para visualizacao.
- Ranking de bairros/regioes, obstaculos de conversao, posicionamento e personas.
- Complemento opcional com OpenAI.
- Exportacao PDF e XLSX no navegador.
- Historico e compartilhamento de analises.
- Autenticacao Clerk protegendo a aplicacao principal na raiz `/`.

## Rotas

- `/` abre a aplicacao principal.
- `/sign-in` abre a tela de login do Clerk.
- `/internal/market-intelligence` redireciona para `/` por compatibilidade com links antigos.
- `/internal/shared/[uuid]` abre relatorios compartilhados em modo somente leitura.
- `/api/analyze` executa a analise.
- `/api/cnpj` consulta dados do CNPJ.
- `/api/history` lista historico do usuario.
- `/api/share` gera link compartilhavel.
- `/api/blob/sas` gera SAS temporario para upload.
- `/.swa/health.html` e uma rota tecnica usada pelo Azure Static Web Apps para validar o deploy. O middleware nao deve bloquear esse caminho.

## Arquitetura

- Framework: Next.js 15 com App Router.
- UI: React 19, Tailwind CSS, lucide-react, Recharts e Leaflet.
- Autenticacao: Clerk.
- Banco: PostgreSQL via Prisma 6.19.3.
- Storage opcional: Azure Blob Storage para uploads temporarios.
- Deploy: Azure Static Web Apps com GitHub Actions.
- Runtime API no Azure: Node 22.
- Saida Next.js: `standalone`, para reduzir o pacote dinamico publicado como Function gerenciada pelo Azure Static Web Apps.

## Leitura do codigo

Como este repositorio pode ser publico, os arquivos principais possuem comentarios explicativos em linguagem simples. A ideia e ajudar novos leitores a entenderem o fluxo da aplicacao sem precisar conhecer Next.js, Prisma, Clerk, Azure ou Google Places em profundidade.

Os comentarios explicam o papel de paginas, componentes, APIs, servicos, tipos e configuracoes. Eles nao devem conter tokens, URLs privadas, connection strings, dados de clientes ou detalhes internos do ambiente de producao.

## Azure Static Web App

Ambiente de destino:

```text
Hosting: Azure Static Web Apps
SKU: Free ou superior
Provider: GitHub Actions
Branch: main
Runtime API: Node 22
```

Configuracao do workflow:

```yaml
app_location: /
api_location: ""
output_location: ""
app_build_command: "npm run build"
```

O build executa:

```bash
prisma generate && next build && node scripts/prepare-standalone.js
```

O `staticwebapp.config.json` define headers de seguranca, noindex, redirect de 401 para `/sign-in` e runtime `node:22`. O `next.config.js` usa `output: 'standalone'`, e o script `scripts/prepare-standalone.js` copia os arquivos estaticos e o cliente Prisma necessario para dentro do pacote gerado pelo Next.

Existe apenas um workflow ativo para deploy:

```text
.github/workflows/azure-static-web-apps.yml
```

Nao crie outro workflow automatico para a mesma Static Web App, pois dois workflows disparados no mesmo `push` podem publicar artefatos diferentes e confundir a analise de falhas.

## Variaveis de ambiente

Veja `.env.example`. Nunca commite `.env`, `.env.local`, tokens, connection strings ou URLs de banco com senha.

O arquivo `.npmrc` do repositorio aponta para o registry publico do npm e desativa audit/fund/progress no CI para reduzir ruido e travamentos durante o build do Azure/Oryx.

Obrigatorias para a aplicacao principal:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL`
- `GOOGLE_PLACES_API_KEY`

Recomendadas para evitar loop de autenticacao em producao:

- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/`

Recomendadas:

- `AZURE_STORAGE_CONNECTION_STRING`
- `AZURE_STORAGE_CONTAINER_NAME`
- `LOCATIONIQ_API_KEY`
- `ORS_API_KEY`
- `GOOGLE_PLACES_MAX_SEARCHES_PER_ANALYSIS`
- `ANALYSIS_RATE_LIMIT_PER_HOUR`
- `SHARED_LINK_TTL_DAYS`

Opcionais:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY`

Observacao sobre `AZURE_STORAGE_CONTAINER_NAME`: este valor deve ser o nome do container, por exemplo `uploads-temp`, nao o nome da storage account.

## Google Places

A busca de concorrentes usa a Places API nova:

```text
https://places.googleapis.com/v1/places:searchText
```

A chave deve ser server-side em `GOOGLE_PLACES_API_KEY`. A API precisa estar habilitada no Google Cloud e a conta precisa ter billing ativo.

A aplicacao nao grava cache vazio quando a chave Google esta ausente. Assim, depois que a chave e configurada, a proxima analise chama o Google Places de verdade.

Se os concorrentes nao aparecerem, verifique:

- Places API habilitada no Google Cloud.
- Billing ativo.
- Restricoes da chave permitindo a Places API.
- Cotas de uso.
- Cache antigo em `PlacesCache` no banco.
- `GOOGLE_PLACES_MAX_SEARCHES_PER_ANALYSIS` baixo demais.

## Rodar localmente

```powershell
npm ci
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
http://localhost:3000/
```

## Deploy

O deploy ocorre por GitHub Actions no workflow:

```text
.github/workflows/azure-static-web-apps.yml
```

O workflow exige o secret:

```text
AZURE_STATIC_WEB_APPS_API_TOKEN
```

Para obter o token da SWA, substitua os placeholders pelo nome do recurso e resource group do ambiente:

```bash
az staticwebapp secrets list \
  --name <STATIC_WEB_APP_NAME> \
  --resource-group <RESOURCE_GROUP_NAME> \
  --query "properties.apiKey" \
  -o tsv
```

Para confirmar se a SWA esta conectada ao repo correto:

```bash
az staticwebapp show \
  --name <STATIC_WEB_APP_NAME> \
  --resource-group <RESOURCE_GROUP_NAME> \
  --query "{provider:provider, repo:repositoryUrl, branch:branch, hostname:defaultHostname}" \
  -o json
```

Resultado esperado:

```json
{
  "provider": "GitHub",
  "repo": "https://github.com/<owner>/<repo>",
  "branch": "main",
  "hostname": "<default-hostname>.azurestaticapps.net"
}
```

## Troubleshooting

### A URL mostra a pagina padrao do Azure

Isso significa que ainda nao houve deploy valido para a SWA. Verifique:

- A SWA esta conectada ao repositorio correto.
- O workflow do GitHub Actions executou com sucesso.
- O secret `AZURE_STATIC_WEB_APPS_API_TOKEN` existe no repositorio.
- O workflow usa `output_location: ""`, nao `build`.
- O build termina sem erro.

### A aplicacao redireciona para login

Isso e esperado. A rota principal `/` e protegida pelo Clerk.

### Erro de Prisma no build

Confirme que o build executa `prisma generate && next build && node scripts/prepare-standalone.js` e que `DATABASE_URL` esta configurada no GitHub Actions/Azure.

### Erro de Prisma em producao por OpenSSL

Se aparecer mensagem dizendo que o Prisma foi gerado para `debian-openssl-1.1.x`, mas o Azure precisa de `debian-openssl-3.0.x`, confirme:

- `prisma/schema.prisma` possui `binaryTargets = ["native", "debian-openssl-1.1.x", "debian-openssl-3.0.x"]`.
- O deploy rodou depois dessa alteracao.
- `scripts/prepare-standalone.js` copiou `node_modules/.prisma` e `node_modules/@prisma/client` para `.next/standalone/node_modules`.

### Falha ao publicar Azure Functions

Em apps Next.js hibridos, o Azure Static Web Apps empacota a parte dinamica como Function gerenciada. Se a publicacao falhar nessa etapa, verifique:

- `next.config.js` contem `output: 'standalone'`.
- O build executa `scripts/prepare-standalone.js` depois de `next build`.
- O middleware nao bloqueia `/.swa/health.html`.
- Existe apenas um workflow de deploy ativo em `.github/workflows`.

### Upload temporario falha

Confirme:

- `AZURE_STORAGE_CONNECTION_STRING`
- `AZURE_STORAGE_CONTAINER_NAME`

Se essas variaveis nao estiverem configuradas, a analise ainda pode seguir com os CEPs processados localmente.

## Seguranca

- Nao cole tokens em comandos com `--debug`, porque o log pode exibir argumentos sensiveis.
- Se um GitHub PAT for exposto, revogue o token imediatamente e gere outro.
- Secrets devem ficar no Azure Static Web Apps ou no GitHub Actions, nunca no repositorio.
- `.env`, `.env.local`, `node_modules` e `.next` nao devem ser versionados.

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
