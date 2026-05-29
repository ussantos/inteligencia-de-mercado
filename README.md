# Inteligencia de Mercado

Aplicacao web independente para analise regional de concorrencia, oportunidades, barreiras comerciais e posicionamento para qualquer tipo de empresa.

A aplicacao esta preparada para rodar em Azure Static Web Apps, conectada a um repositorio GitHub privado ou publico configurado no ambiente de deploy.

Você pode testar a aplicação nesta URL: https://gray-glacier-0dc52610f.7.azurestaticapps.net/sign-in

## Carater educativo, cursos e licenca

Este projeto tem carater educativo e demonstra como aplicar conceitos de inteligencia artificial, automacao, desenvolvimento web e analise de dados em uma ferramenta pratica de inteligencia de mercado.

A ferramenta foi criada como projeto aplicado inspirado nos conceitos apresentados nos cursos [Inteligencia Artificial](https://www.myrobotbarra.com.br/inteligencia-artificial.html) e [App Developer](https://www.myrobotbarra.com.br/app-developer.html), da My Robot Barra da Tijuca.

O codigo-fonte esta disponivel no GitHub em [ussantos/inteligencia-de-mercado](https://github.com/ussantos/inteligencia-de-mercado) sob a licenca [GNU GPL](https://www.gnu.org/licenses/gpl-3.0.html).

## LGPD e privacidade

A aplicacao deve ser usada com atencao a LGPD. O fluxo foi desenhado para processar temporariamente apenas os dados necessarios para a analise regional. No upload de planilhas, apenas CEPs sao usados; nomes, telefones, e-mails, CPF e outros dados pessoais devem ser evitados e, quando presentes, sao ignorados pela aplicacao.

Nao inclua dados sensiveis, listas completas de clientes, credenciais, tokens, connection strings ou informacoes privadas em arquivos enviados, commits, issues ou exemplos publicos.

## Proposito

A ferramenta transforma dados publicos e dados operacionais simples em um relatorio pratico de inteligencia de mercado. A analise parte do CNPJ da empresa, identifica endereco e CNAEs, cruza a regiao com locais do Google Places, aceita uma planilha opcional de CEPs de clientes e gera recomendacoes para marketing, vendas, posicionamento e expansao local.

## Funcionalidades

- Consulta de empresa por CNPJ usando fontes publicas, com cache em Postgres.
- Identificacao automatica de endereco, CEP e CNAEs.
- Selecao de CNAEs e tipos de concorrentes/alternativas de mercado.
- Analise por raio em torno do empreendimento, com padrao de 8 km.
- Upload opcional de CSV/XLSX com CEPs de clientes.
- Exclusao do arquivo temporario do Azure Blob Storage depois que a analise termina com sucesso.
- Modelo CSV baixavel para preencher CEPs antes do upload.
- Normalizacao e validacao de CEPs.
- Geocodificacao com LocationIQ e fallback Nominatim.
- Distancia por linha reta e, quando configurado, rota com OpenRouteService.
- Busca de concorrentes e locais relevantes via Google Places API.
- Mapa Google Maps com camadas para empresa, CEPs, concorrentes, barreiras, locais relevantes e calor dos CEPs.
- Ranking de bairros/regioes, obstaculos de conversao, posicionamento e personas.
- Complemento opcional com OpenAI para enriquecer recomendacoes inteligentes, posicionamento, evolucao incremental e plano de acao.
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
- `/api/blob/upload` envia arquivo temporario para o Azure Blob Storage pelo servidor.
- `/api/blob/sas` gera SAS temporario para upload legado.
- `/api/blob/delete` apaga o blob temporario depois da analise.
- `/.swa/health.html` e uma rota tecnica usada pelo Azure Static Web Apps para validar o deploy. O middleware nao deve bloquear esse caminho.

## Arquitetura

- Framework: Next.js 15 com App Router.
- UI: React 19, Tailwind CSS, lucide-react, Recharts e Google Maps JavaScript API.
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
- `GOOGLE_MAPS_SERVER_API_KEY` ou `GOOGLE_PLACES_API_KEY`

Obrigatoria para exibir o mapa Google Maps no navegador:

- `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY`

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
- `MONTHLY_BUDGET_ENABLED`
- `MONTHLY_BUDGET_PERCENT`

Opcionais:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `GOOGLE_PLACES_MONTHLY_FREE_QUOTA` ou `GOOGLE_PLACES_MONTHLY_BUDGET`
- `LOCATIONIQ_MONTHLY_FREE_QUOTA` ou `LOCATIONIQ_MONTHLY_BUDGET`
- `ORS_MONTHLY_FREE_QUOTA` ou `ORS_MONTHLY_BUDGET`
- `OPENAI_MONTHLY_FREE_QUOTA` ou `OPENAI_MONTHLY_BUDGET`
- `CNPJ_PUBLIC_MONTHLY_BUDGET`
- `VIACEP_MONTHLY_BUDGET`
- `NOMINATIM_MONTHLY_BUDGET`
- `OVERPASS_MONTHLY_BUDGET`

Quando `OPENAI_API_KEY` esta configurada, a aplicacao envia um resumo da analise para a IA e melhora as secoes **Recomendacoes Inteligentes** e **Plano de Acao — Proximos Passos** com orientacoes mais especificas por bairro, concorrentes, CNAEs, raio analisado e limitacoes encontradas. Sem essa chave, o relatorio continua funcionando com regras locais.

Observacao sobre `AZURE_STORAGE_CONTAINER_NAME`: este valor deve ser o nome do container, por exemplo `uploads-temp`, nao o nome da storage account.

## APIs, servicos externos e leituras necessarias

Para implementar ou adaptar este sistema em outro ambiente, leia a documentacao de cada servico usado e configure as chaves com escopos separados. A regra mais importante e: chave publica de navegador so para recursos que precisam aparecer no browser; chave server-side so no Azure/GitHub Secrets.

### Azure Static Web Apps

Uso no projeto: hospedagem, variaveis de ambiente, GitHub Actions e runtime gerenciado para rotas dinamicas do Next.js.

Leia principalmente:

- [Application settings do Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/application-settings), para entender como publicar secrets e variaveis usadas pela API.
- [Build configuration do Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration), para confirmar `app_location`, `output_location`, token de deploy e integracao com GitHub Actions.

Configure:

- `AZURE_STATIC_WEB_APPS_API_TOKEN` como secret no GitHub Actions.
- Variaveis de producao no Azure Static Web Apps em **Environment variables**.
- Apenas um workflow ativo para evitar deploys concorrentes.

### Azure Blob Storage

Uso no projeto: upload temporario de CSV/XLSX de CEPs e exclusao do arquivo depois que a analise termina.

Leia principalmente:

- [Upload de blobs com JavaScript/TypeScript](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-upload-javascript), para entender containers, blobs e cliente `@azure/storage-blob`.
- Documentacao de lifecycle management do Azure Storage, caso queira apagar automaticamente blobs antigos como segunda camada de seguranca.

Configure:

- `AZURE_STORAGE_CONNECTION_STRING`
- `AZURE_STORAGE_CONTAINER_NAME`
- Uma regra de lifecycle no container temporario, recomendada mesmo com a exclusao feita pela aplicacao.

### Clerk

Uso no projeto: autenticacao, tela `/sign-in`, protecao das rotas e sessao do usuario.

Leia principalmente:

- [Variaveis e chaves do Clerk](https://clerk.com/docs/upgrade-guides/api-keys), para separar publishable key e secret key.
- [Pagina customizada de sign-in/sign-up do Clerk para Next.js](https://clerk.com/docs/nextjs/guides/development/custom-sign-in-or-up-page), para entender URLs de entrada e redirecionamento.

Configure:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/`

### PostgreSQL e Prisma

Uso no projeto: cache de CNPJ, cache de Places, historico, compartilhamento e controle de cotas mensais.

Leia principalmente:

- [Data sources do Prisma](https://www.prisma.io/docs/orm/v6/prisma-schema/overview/data-sources), para entender como o Prisma usa a URL do banco.
- [Connection URLs do Prisma](https://www.prisma.io/docs/orm/reference/connection-urls), para montar corretamente `DATABASE_URL`.

Configure:

- `DATABASE_URL`
- `prisma generate` no build.
- `binaryTargets` no `schema.prisma` para o ambiente Linux/OpenSSL usado pelo Azure.

### Google Maps JavaScript API

Uso no projeto: mapa visual do relatorio, camadas, marcadores e mapa de calor.

Leia principalmente:

- [Troubleshooting da Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/troubleshooting), para erros de chave, billing, APIs nao habilitadas e restricoes incorretas.
- [Politicas e atribuicoes da Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/policies), para uso correto dos mapas e conteudos do Google.

Configure:

- `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY`
- Ative **Maps JavaScript API** no Google Cloud.
- Restrinja esta chave por **HTTP referrer**, permitindo o dominio do Azure Static Web Apps e o dominio final de producao.
- Nao use esta chave publica no backend.

### Google Places API (New)

Uso no projeto: busca de concorrentes, locais relevantes, avaliacoes, quantidade de avaliacoes, enderecos e tipos de locais.

Leia principalmente:

- [Text Search (New)](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places/searchText), porque o sistema chama `places:searchText`.
- [Visao geral da Places API (New)](https://developers.google.com/maps/documentation/places/web-service/op-overview), para entender tipos de busca, campos retornados e cobranca.

Configure:

- `GOOGLE_MAPS_SERVER_API_KEY` ou `GOOGLE_PLACES_API_KEY`
- Ative **Places API** no Google Cloud.
- Permita a **Places API** nas restricoes de API da chave.
- Use uma chave separada da chave do navegador.
- Nao aplique restricao de HTTP referrer nessa chave server-side; se quiser restringir, use mecanismos apropriados para chamadas de servidor.
- Verifique billing, cotas e logs do Google Cloud.

### LocationIQ

Uso no projeto: geocodificacao de enderecos e CEPs quando a chave esta configurada.

Leia principalmente:

- [Documentacao da LocationIQ](https://docs.locationiq.com/docs/choose-the-right-api), para escolher Search/Forward Geocoding.
- [API Reference da LocationIQ](https://api-reference.locationiq.com/), para parametros, limites e formato de resposta.

Configure:

- `LOCATIONIQ_API_KEY`
- Limites mensais por `LOCATIONIQ_MONTHLY_FREE_QUOTA` ou `LOCATIONIQ_MONTHLY_BUDGET`, se quiser controlar uso.

### OpenRouteService

Uso no projeto: distancia de carro e tempo estimado quando a chave esta configurada; sem ela, a aplicacao usa distancia em linha reta.

Leia principalmente:

- [Matrix Endpoint do OpenRouteService](https://giscience.github.io/openrouteservice/v8.2.0/api-reference/endpoints/matrix/), porque o sistema usa matriz de distancia/tempo.

Configure:

- `ORS_API_KEY`
- `ORS_MONTHLY_FREE_QUOTA` ou `ORS_MONTHLY_BUDGET`, se quiser limitar chamadas.

### OpenAI API

Uso no projeto: enriquecimento opcional das recomendacoes, posicionamento, personas e plano de acao.

Leia principalmente:

- [Pricing da OpenAI API](https://platform.openai.com/docs/pricing), para custo por modelo e tokens.
- [Rate limits da OpenAI API](https://help.openai.com/en/articles/5955598), para entender limites por projeto/organizacao.

Configure:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_MONTHLY_BUDGET`, lembrando que o freio interno conta chamadas, nao custo exato por token.

### Fontes publicas de CNPJ e CEP

Uso no projeto: dados cadastrais da empresa, endereco, CNAEs e normalizacao de CEPs.

Leia principalmente:

- [ReceitaWS Developers](https://developers.receitaws.com.br/), para entender API publica/comercial, cache e limites.
- [OpenCNPJ](https://opencnpj.com/), para consulta publica de CNPJ.
- [ViaCEP](https://viacep.com.br/), para formato de CEP e retorno de endereco.
- [BrasilAPI CNPJ](https://brasilapi.com.br/docs#tag/CNPJ), se quiser manter ou ampliar fontes publicas de CNPJ.

Configure:

- Nao ha chave obrigatoria para ViaCEP.
- Use cache no banco para reduzir chamadas repetidas.
- Configure limites conservadores com `CNPJ_PUBLIC_MONTHLY_BUDGET` e `VIACEP_MONTHLY_BUDGET`, se necessario.

### Nominatim e Overpass

Uso no projeto: fallback legado para geocodificacao e locais baseados em OpenStreetMap. O mapa principal do relatorio agora usa Google Maps.

Leia principalmente:

- [Politica de uso do Nominatim](https://operations.osmfoundation.org/policies/nominatim/), porque o servico publico tem limites e exige uso responsavel.
- [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API), para entender consultas OSM caso decida reativar ou ampliar esse fallback.

Configure:

- Use como fallback, nao como fonte intensiva.
- Configure `NOMINATIM_MONTHLY_BUDGET` e `OVERPASS_MONTHLY_BUDGET`, se quiser freios adicionais.

## Controle de cotas e custos

A aplicacao possui dois tipos de freio:

- `ANALYSIS_RATE_LIMIT_PER_HOUR` limita quantas analises cada usuario pode iniciar por hora.
- As variaveis `*_MONTHLY_FREE_QUOTA`, `*_MONTHLY_BUDGET`, `MONTHLY_BUDGET_PERCENT` e `MONTHLY_BUDGET_ENABLED` limitam chamadas mensais globais para APIs externas.

Para ficar em cerca de 60% do limite gratuito de um fornecedor, consulte o limite atual no painel oficial do servico e configure os valores reais do seu projeto:

```env
MONTHLY_BUDGET_ENABLED=true
MONTHLY_BUDGET_PERCENT=60
GOOGLE_PLACES_MONTHLY_FREE_QUOTA=<limite_mensal_google_places>
LOCATIONIQ_MONTHLY_FREE_QUOTA=<limite_mensal_locationiq>
ORS_MONTHLY_FREE_QUOTA=<limite_mensal_openrouteservice>
OPENAI_MONTHLY_BUDGET=<maximo_mensal_de_chamadas_openai>
```

Tambem e possivel informar o limite direto ja calculado:

```env
GOOGLE_PLACES_MONTHLY_BUDGET=<60_porcento_do_limite_google_places>
LOCATIONIQ_MONTHLY_BUDGET=<60_porcento_do_limite_locationiq>
ORS_MONTHLY_BUDGET=<60_porcento_do_limite_openrouteservice>
```

O contador mensal e salvo na tabela `UserRateLimit` com uma chave tecnica do sistema, sem criar uma nova tabela. Quando o limite configurado e atingido, a chamada externa e bloqueada e a analise usa fallback quando existir, como cache, distancia em linha reta, Nominatim ou recomendacoes locais.

Para fontes publicas sem chave, como CNPJ, ViaCEP, Nominatim e Overpass, nao ha uma unica variavel universal de free tier mensal. Se quiser ser conservador, configure limites diretos como `CNPJ_PUBLIC_MONTHLY_BUDGET`, `VIACEP_MONTHLY_BUDGET`, `NOMINATIM_MONTHLY_BUDGET` e `OVERPASS_MONTHLY_BUDGET`.

Importante: os limites gratuitos mudam com o tempo e variam por conta, projeto, API, SKU e billing. Por isso a aplicacao nao fixa numeros como verdade absoluta. Configure os valores de acordo com o painel atual do Google Cloud, LocationIQ, OpenRouteService e OpenAI. No caso da OpenAI, o freio da aplicacao conta chamadas, nao tokens nem custo financeiro exato; use tambem os controles de uso/billing do provedor.

## Upload temporario no Azure Blob

O arquivo CSV/XLSX de CEPs e lido no navegador, e apenas os CEPs seguem para a analise. Quando o Azure Blob Storage esta configurado, a aplicacao tambem envia o arquivo para um container temporario pela rota `/api/blob/upload`.

O upload passa pelo servidor para evitar erro de CORS no navegador. A rota antiga `/api/blob/sas` continua existindo por compatibilidade, mas a tela principal nao depende mais de upload direto do navegador para o Blob Storage.

Depois que a analise termina com sucesso, a rota `/api/blob/delete` apaga o blob temporario pelo nome gerado pela aplicacao. Como camada extra de seguranca operacional, tambem e recomendado configurar uma regra de lifecycle no proprio Azure Storage para apagar blobs antigos do container temporario caso alguma sessao seja interrompida antes da limpeza pela aplicacao.

## Google Places

A busca de concorrentes usa a Places API nova:

```text
https://places.googleapis.com/v1/places:searchText
```

A chave deve ser server-side em `GOOGLE_MAPS_SERVER_API_KEY` ou `GOOGLE_PLACES_API_KEY`. A chave publica `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY` serve para mapas no navegador e nao deve ser usada pelo backend para buscar concorrentes. A API precisa estar habilitada no Google Cloud e a conta precisa ter billing ativo.

Se o diagnostico mostrar `API_KEY_HTTP_REFERRER_BLOCKED`, a chave usada no backend esta restrita por site/referrer. Crie uma chave separada para o servidor, permita a **Places API** nas restricoes de API e nao aplique restricao de HTTP referrer nessa chave. Depois cadastre essa chave no Azure Static Web Apps e nos secrets do GitHub como `GOOGLE_MAPS_SERVER_API_KEY` ou substitua `GOOGLE_PLACES_API_KEY`.

A aplicacao nao grava cache vazio quando a chave Google esta ausente. Assim, depois que a chave e configurada, a proxima analise chama o Google Places de verdade.

Se os concorrentes nao aparecerem, verifique:

- Places API habilitada no Google Cloud.
- Billing ativo.
- Restricoes da chave permitindo a Places API.
- Chave de servidor sem restricao de HTTP referrer para `GOOGLE_MAPS_SERVER_API_KEY` ou `GOOGLE_PLACES_API_KEY`.
- Cotas de uso.
- Cache antigo em `PlacesCache` no banco.
- `GOOGLE_PLACES_MAX_SEARCHES_PER_ANALYSIS` baixo demais.
- Resultado vazio antigo em `PlacesCache`. A aplicacao ignora caches vazios novos, mas registros antigos podem existir no banco.

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
