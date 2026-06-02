# Inteligencia de Mercado

[For English click here](#english-version)

Aplicacao web independente para analise regional de concorrencia, oportunidades, barreiras comerciais e posicionamento para qualquer tipo de empresa.

A aplicacao esta preparada para rodar em Azure Static Web Apps, conectada a um repositorio GitHub privado ou publico configurado no ambiente de deploy.

Voce pode testar a aplicacao nesta URL: https://gray-glacier-0dc52610f.7.azurestaticapps.net/

## Carater educativo, cursos e licenca

Este projeto tem carater educativo e demonstra como aplicar conceitos de inteligencia artificial, automacao, desenvolvimento web e analise de dados em uma ferramenta pratica de inteligencia de mercado.

A ferramenta foi criada como projeto aplicado inspirado nos conceitos apresentados nos cursos [Inteligencia Artificial](https://www.myrobotbarra.com.br/inteligencia-artificial.html) e [App Developer](https://www.myrobotbarra.com.br/app-developer.html), da My Robot Barra da Tijuca.

O codigo-fonte esta disponivel no GitHub em [ussantos/inteligencia-de-mercado](https://github.com/ussantos/inteligencia-de-mercado) sob a licenca [GNU GPL](https://www.gnu.org/licenses/gpl-3.0.html).

Este sistema nao e um produto comercial vendido, licenciado ou garantido pela My Robot Barra da Tijuca, por seus responsaveis ou por seus colaboradores. O codigo e disponibilizado sem garantia de funcionamento, continuidade, seguranca, adequacao tecnica ou adequacao juridica, trabalhista, fiscal, contabil e de protecao de dados.

Qualquer uso por outras empresas, franquias, negocios, organizacoes ou terceiros ocorre por conta e risco proprios. Antes de usar, adaptar ou implantar este sistema, cada organizacao deve validar a aplicacao com seus responsaveis tecnicos, juridicos, contabeis, trabalhistas e de protecao de dados.

## LGPD e privacidade

A aplicacao deve ser usada com atencao a LGPD. O fluxo foi desenhado para processar temporariamente apenas os dados necessarios para a analise regional. No upload de planilhas, apenas CEPs sao usados; nomes, telefones, e-mails, CPF e outros dados pessoais devem ser evitados e, quando presentes, sao ignorados pela aplicacao.

Nao inclua dados sensiveis, listas completas de clientes, credenciais, tokens, connection strings ou informacoes privadas em arquivos enviados, commits, issues ou exemplos publicos.

## Proposito

A ferramenta transforma dados publicos e dados operacionais simples em um relatorio pratico de inteligencia de mercado. A analise pode partir de um negocio existente com CNPJ ou de um estudo de abertura de novo negocio. O usuario informa o ramo de atividade, uma localizacao por CEP ou endereco, escolhe o raio e os tipos de concorrentes, e a aplicacao cruza a regiao com locais do Google Places para gerar recomendacoes de marketing, vendas, posicionamento e proximos passos.

## Funcionalidades

- Fluxo publico, sem login obrigatorio.
- Consulta opcional de empresa por CNPJ usando fontes publicas, com cache em Postgres.
- Identificacao automatica de endereco e CEP a partir do CNPJ quando ele e informado.
- Analise manual para quem ainda nao tem empresa aberta: basta informar ramo de atividade e uma localizacao de referencia.
- Descricao obrigatoria do ramo de atividade para definir o escopo real da analise e das consultas ao Google Places.
- Selecao de tipos de concorrentes/alternativas de mercado; a busca de concorrentes deve respeitar o ramo informado e essas escolhas.
- Analise por raio em torno do empreendimento, com slider de 1 a 20 km e padrao de 4 km.
- Upload opcional de CSV/XLSX com CEPs de clientes apenas quando houver CNPJ de um negocio existente.
- Exclusao do arquivo temporario do Azure Blob Storage depois que a analise termina com sucesso.
- Modelo CSV baixavel para preencher CEPs antes do upload.
- Normalizacao e validacao de CEPs.
- Geocodificacao com LocationIQ e fallback Nominatim.
- Distancia por linha reta e, quando configurado, rota com OpenRouteService.
- Busca de concorrentes e locais relevantes via Google Places API.
- Mapa Google Maps com camadas para empresa, CEPs, concorrentes, barreiras e locais relevantes.
- Ranking de bairros de clientes apenas quando uma planilha de CEPs e enviada; sem CEPs, o relatorio omite afinidade e bairros de clientes e mostra somente concorrentes, barreiras e oportunidades ao redor.
- Relatorio simplificado com resumo executivo, recomendacoes, mapa, concorrentes principais, clientes informados quando existirem e proximos passos.
- Obstaculos de conversao, posicionamento e recomendacoes com explicacao de como interpretar cada secao.
- Canvas Estrategico do Negocio mantido no relatorio impresso e no motor de analise, mas a tela prioriza uma leitura mais curta e vendavel.
- Complemento opcional com OpenAI para enriquecer recomendacoes inteligentes, posicionamento, Canvas Estrategico, evolucao incremental e plano de acao.
- Impressao da analise com layout especifico para PDF, em folha A4 retrato, com mapa esquematico, graficos, quebras de pagina controladas e secoes compactas para evitar cortes no meio do conteudo.
- Historico e compartilhamento de analises por identificador anonimo do visitante.

## Rotas

- `/` abre a aplicacao principal.
- `/sign-in` redireciona para `/` por compatibilidade com links antigos.
- `/internal/market-intelligence` redireciona para `/` por compatibilidade com links antigos.
- `/internal/shared/[uuid]` abre relatorios compartilhados em modo somente leitura.
- `/api/analyze` executa a analise.
- `/api/cnpj` consulta dados do CNPJ.
- `/api/history` lista historico do visitante anonimo.
- `/api/share` gera link compartilhavel.
- `/api/blob/upload` envia arquivo temporario para o Azure Blob Storage pelo servidor.
- `/api/blob/sas` gera SAS temporario para upload legado.
- `/api/blob/delete` apaga o blob temporario depois da analise.
- `/.swa/health.html` e uma rota tecnica usada pelo Azure Static Web Apps para validar o deploy. O middleware nao deve bloquear esse caminho.

## Arquitetura

- Framework: Next.js 15 com App Router.
- UI: React 19, Tailwind CSS, lucide-react, Recharts e Google Maps JavaScript API.
- Autenticacao: nao ha login obrigatorio; a aplicacao usa identificador anonimo local para rate limit e historico simples.
- Banco: PostgreSQL via Prisma 6.19.3.
- Storage opcional: Azure Blob Storage para uploads temporarios.
- Deploy: Azure Static Web Apps com GitHub Actions.
- Runtime API no Azure: Node 22.
- Saida Next.js: `standalone`, para reduzir o pacote dinamico publicado como Function gerenciada pelo Azure Static Web Apps.

## Leitura do codigo

Como este repositorio pode ser publico, os arquivos principais possuem comentarios explicativos em linguagem simples. A ideia e ajudar novos leitores a entenderem o fluxo da aplicacao sem precisar conhecer Next.js, Prisma, Azure ou Google Places em profundidade.

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

O `staticwebapp.config.json` define headers de seguranca, noindex e runtime `node:22`. O `next.config.js` usa `output: 'standalone'`, e o script `scripts/prepare-standalone.js` copia os arquivos estaticos e o cliente Prisma necessario para dentro do pacote gerado pelo Next.

Existe apenas um workflow ativo para deploy:

```text
.github/workflows/azure-static-web-apps.yml
```

Nao crie outro workflow automatico para a mesma Static Web App, pois dois workflows disparados no mesmo `push` podem publicar artefatos diferentes e confundir a analise de falhas.

## Variaveis de ambiente

Veja `.env.example`. Nunca commite `.env`, `.env.local`, tokens, connection strings ou URLs de banco com senha.

O arquivo `.npmrc` do repositorio aponta para o registry publico do npm e desativa audit/fund/progress no CI para reduzir ruido e travamentos durante o build do Azure/Oryx.

Obrigatorias para a aplicacao principal:

- `DATABASE_URL`
- `GOOGLE_MAPS_SERVER_API_KEY` ou `GOOGLE_PLACES_API_KEY`

Obrigatoria para exibir o mapa Google Maps no navegador:

- `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY`

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

Quando `OPENAI_API_KEY` esta configurada, a aplicacao envia um resumo da analise para a IA e melhora as secoes **Recomendacoes Inteligentes**, **Canvas Estrategico do Negocio** e **Plano de Acao — Proximos Passos** com orientacoes mais especificas a partir do ramo informado, concorrentes, CEPs de clientes quando enviados, raio analisado e limitacoes encontradas. Sem essa chave, o relatorio continua funcionando com regras locais.

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

Uso no projeto: mapa visual do relatorio, camadas e marcadores de empresa, CEPs, concorrentes e locais relevantes.

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

Uso no projeto: dados cadastrais da empresa, endereco, CEP da empresa e normalizacao de CEPs de clientes quando enviados.

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

As consultas ao Google Places sao montadas a partir do ramo de atividade descrito pelo usuario e dos tipos de concorrentes escolhidos. Quando o CNPJ e informado, ele ajuda a localizar uma empresa existente e confirmar dados cadastrais; quando nao ha CNPJ, a aplicacao usa o endereco informado manualmente como ponto central do raio. O CNAE cadastral nao define a busca de concorrentes.

O Google Places nao retorna CNPJ diretamente. Quando ha CNPJ informado, para evitar listar a propria empresa como concorrente, a aplicacao cruza os resultados do Google com os dados cadastrais usando telefone, endereco, coordenadas, dominio do site/e-mail, similaridade de nome e, quando o site do resultado esta disponivel, busca o CNPJ da empresa na pagina retornada. Resultados identificados como a propria empresa sao removidos antes do relatorio.

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

### A aplicacao ainda abre `/sign-in`

O fluxo atual nao usa login. A rota `/sign-in` existe apenas por compatibilidade com links antigos e redireciona para `/`. Se o navegador insistir em abrir `/sign-in`, limpe cache ou use diretamente a raiz do site.

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

---

## English Version

# Market Intelligence

Independent web application for regional competitor analysis, opportunity mapping, commercial barrier detection, and positioning strategy for any type of business.

The application is prepared to run on Azure Static Web Apps, connected to a private or public GitHub repository configured in the deployment environment.

You can test the application at: https://gray-glacier-0dc52610f.7.azurestaticapps.net/

## Educational Purpose, Courses, and License

This project is educational and demonstrates how to apply artificial intelligence, automation, web development, and data analysis concepts to a practical market intelligence tool.

The tool was created as an applied project inspired by concepts presented in the [Artificial Intelligence](https://www.myrobotbarra.com.br/inteligencia-artificial.html) and [App Developer](https://www.myrobotbarra.com.br/app-developer.html) courses from My Robot Barra da Tijuca.

The source code is available on GitHub at [ussantos/inteligencia-de-mercado](https://github.com/ussantos/inteligencia-de-mercado) under the [GNU GPL](https://www.gnu.org/licenses/gpl-3.0.html) license.

This system is not a commercial product sold, licensed, or guaranteed by My Robot Barra da Tijuca, its owners, or its collaborators. The code is provided without any warranty of operation, continuity, security, technical suitability, legal suitability, labor compliance, tax compliance, accounting suitability, or data protection adequacy.

Any use by other companies, franchises, businesses, organizations, or third parties is at their own risk. Before using, adapting, or deploying this system, each organization must validate the application with its technical, legal, accounting, labor, and data protection advisors.

## LGPD and Privacy

The application must be used with attention to Brazil's LGPD data protection law. The workflow was designed to temporarily process only the data needed for regional analysis. In spreadsheet uploads, only ZIP/postal codes are used; names, phone numbers, emails, CPF numbers, and other personal data should be avoided and, if present, are ignored by the application.

Do not include sensitive data, complete customer lists, credentials, tokens, connection strings, or private information in uploaded files, commits, issues, or public examples.

## Purpose

The tool transforms public data and simple operational data into a practical market intelligence report. The analysis can start from an existing business with a CNPJ or from a new-business study. The user provides the business activity, a reference location by ZIP/postal code or address, the radius, and the competitor types; the application compares the region with Google Places results and generates recommendations for marketing, sales, positioning, and next steps.

## Features

- Public workflow with no required login.
- Optional company lookup by CNPJ using public sources, with PostgreSQL cache.
- Automatic identification of address and ZIP/postal code from the CNPJ when provided.
- Manual study flow for users who do not have an open company yet: business activity plus a reference location is enough.
- Required business activity description to define the real scope of the analysis and Google Places queries.
- Selection of competitor or market alternative types; competitor searches should respect the described activity and these user choices.
- Radius-based analysis around the business with a 1 to 20 km slider and a 4 km default.
- Optional CSV/XLSX upload with customer ZIP/postal codes only when an existing business CNPJ is provided.
- Deletion of the temporary Azure Blob Storage file after the analysis completes successfully.
- Downloadable CSV template for ZIP/postal codes.
- ZIP/postal code normalization and validation.
- Geocoding with LocationIQ and Nominatim fallback.
- Straight-line distance and, when configured, route distance with OpenRouteService.
- Competitor and relevant-place search through Google Places API.
- Google Maps view with layers for the company, customer ZIP/postal codes, competitors, barriers, and relevant places.
- Customer neighborhood ranking only when a ZIP/postal code spreadsheet is uploaded; without ZIP/postal codes, the report omits customer affinity and customer neighborhoods and shows only nearby competitors, obstacles, and opportunities.
- Simplified result page with executive summary, recommendations, map, main competitors, customer ZIP/postal codes when available, and next steps.
- Conversion barriers, positioning, and recommendations with explanations about how to interpret each section.
- Strategic Business Canvas still generated by the analysis engine and available in the print report, while the screen prioritizes a shorter, more sellable view.
- Optional OpenAI enrichment for smarter recommendations, positioning, Strategic Business Canvas, incremental evolution, and action planning.
- Print-ready analysis layout for PDF, using A4 portrait pages, schematic map, charts, controlled page breaks, and compact sections to avoid splitting content in the middle.
- Analysis history and shareable reports by anonymous visitor identifier.

## Routes

- `/` opens the main application.
- `/sign-in` redirects to `/` for compatibility with old links.
- `/internal/market-intelligence` redirects to `/` for compatibility with old links.
- `/internal/shared/[uuid]` opens shared reports in read-only mode.
- `/api/analyze` runs the analysis.
- `/api/cnpj` fetches CNPJ data.
- `/api/history` lists the anonymous visitor history.
- `/api/share` creates a shareable link.
- `/api/blob/upload` uploads a temporary file to Azure Blob Storage through the server.
- `/api/blob/sas` creates a temporary SAS for legacy upload flows.
- `/api/blob/delete` deletes the temporary blob after the analysis.
- `/.swa/health.html` is a technical route used by Azure Static Web Apps to validate deployment. Middleware must not block this path.

## Architecture

- Framework: Next.js 15 with App Router.
- UI: React 19, Tailwind CSS, lucide-react, Recharts, and Google Maps JavaScript API.
- Authentication: no required login; the application uses a local anonymous identifier for basic rate limiting and simple history.
- Database: PostgreSQL through Prisma 6.19.3.
- Optional storage: Azure Blob Storage for temporary uploads.
- Deployment: Azure Static Web Apps with GitHub Actions.
- Azure API runtime: Node 22.
- Next.js output: `standalone`, to reduce the dynamic package published as a managed Azure Static Web Apps Function.

## Code Readability

Because this repository may be public, the main files include explanatory comments in simple language. The goal is to help new readers understand the application flow without deep knowledge of Next.js, Prisma, Azure, or Google Places.

Comments explain the purpose of pages, components, APIs, services, types, and configuration. They must not include tokens, private URLs, connection strings, customer data, or internal production details.

## Azure Static Web App

Target environment:

```text
Hosting: Azure Static Web Apps
SKU: Free or higher
Provider: GitHub Actions
Branch: main
API runtime: Node 22
```

Workflow configuration:

```yaml
app_location: /
api_location: ""
output_location: ""
app_build_command: "npm run build"
```

The build runs:

```bash
prisma generate && next build && node scripts/prepare-standalone.js
```

`staticwebapp.config.json` defines security headers, noindex, and `node:22` runtime. `next.config.js` uses `output: 'standalone'`, and `scripts/prepare-standalone.js` copies static files and the Prisma client needed inside the package generated by Next.js.

There should be only one active deployment workflow:

```text
.github/workflows/azure-static-web-apps.yml
```

Do not create another automatic workflow for the same Static Web App, because two workflows triggered by the same `push` may publish different artifacts and make deployment failures harder to diagnose.

## Environment Variables

See `.env.example`. Never commit `.env`, `.env.local`, tokens, connection strings, or database URLs with passwords.

Required for the main application:

- `DATABASE_URL`
- `GOOGLE_MAPS_SERVER_API_KEY` or `GOOGLE_PLACES_API_KEY`

Required to display Google Maps in the browser:

- `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY`

Recommended:

- `AZURE_STORAGE_CONNECTION_STRING`
- `AZURE_STORAGE_CONTAINER_NAME`
- `LOCATIONIQ_API_KEY`
- `ORS_API_KEY`
- `GOOGLE_PLACES_MAX_SEARCHES_PER_ANALYSIS`
- `ANALYSIS_RATE_LIMIT_PER_HOUR`
- `SHARED_LINK_TTL_DAYS`
- `MONTHLY_BUDGET_ENABLED`
- `MONTHLY_BUDGET_PERCENT`

Optional:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `GOOGLE_PLACES_MONTHLY_FREE_QUOTA` or `GOOGLE_PLACES_MONTHLY_BUDGET`
- `LOCATIONIQ_MONTHLY_FREE_QUOTA` or `LOCATIONIQ_MONTHLY_BUDGET`
- `ORS_MONTHLY_FREE_QUOTA` or `ORS_MONTHLY_BUDGET`
- `OPENAI_MONTHLY_FREE_QUOTA` or `OPENAI_MONTHLY_BUDGET`
- `CNPJ_PUBLIC_MONTHLY_BUDGET`
- `VIACEP_MONTHLY_BUDGET`
- `NOMINATIM_MONTHLY_BUDGET`
- `OVERPASS_MONTHLY_BUDGET`

When `OPENAI_API_KEY` is configured, the application sends a summary of the analysis to AI and improves the **Smart Recommendations**, **Strategic Business Canvas**, and **Action Plan — Next Steps** sections with more specific guidance based on the described business activity, competitors, customer ZIP/postal codes when uploaded, analysis radius, and limitations found. Without this key, the report continues to work with local rules.

Note about `AZURE_STORAGE_CONTAINER_NAME`: this value must be the container name, for example `uploads-temp`, not the storage account name.

## APIs, External Services, and Required Reading

To implement or adapt this system in another environment, read the documentation for each service and configure separate keys with scoped permissions. The most important rule is: public browser keys only for resources that must appear in the browser; server-side keys only in Azure/GitHub Secrets.

### Azure Static Web Apps

Used for hosting, environment variables, GitHub Actions, and managed runtime for dynamic Next.js routes.

Read:

- [Azure Static Web Apps application settings](https://learn.microsoft.com/en-us/azure/static-web-apps/application-settings)
- [Azure Static Web Apps build configuration](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration)

Configure:

- `AZURE_STATIC_WEB_APPS_API_TOKEN` as a GitHub Actions secret.
- Production variables in Azure Static Web Apps **Environment variables**.
- Only one active workflow to avoid concurrent deployments.

### Azure Blob Storage

Used for temporary CSV/XLSX uploads and file deletion after the analysis completes.

Read:

- [Upload blobs with JavaScript/TypeScript](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-upload-javascript)
- Azure Storage lifecycle management documentation, if you want a second cleanup layer for old blobs.

Configure:

- `AZURE_STORAGE_CONNECTION_STRING`
- `AZURE_STORAGE_CONTAINER_NAME`
- A lifecycle rule on the temporary container, recommended even though the application deletes files after successful analysis.

### PostgreSQL and Prisma

Used for CNPJ cache, Places cache, history, sharing, and monthly quota control.

Read:

- [Prisma data sources](https://www.prisma.io/docs/orm/v6/prisma-schema/overview/data-sources)
- [Prisma connection URLs](https://www.prisma.io/docs/orm/reference/connection-urls)

Configure:

- `DATABASE_URL`
- `prisma generate` during build.
- `binaryTargets` in `schema.prisma` for the Linux/OpenSSL environment used by Azure.

### Google Maps JavaScript API

Used for the visual report map, layers, and markers for the company, ZIP/postal codes, competitors, and relevant places.

Read:

- [Maps JavaScript API troubleshooting](https://developers.google.com/maps/documentation/javascript/troubleshooting)
- [Maps JavaScript API policies and attribution](https://developers.google.com/maps/documentation/javascript/policies)

Configure:

- `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY`
- Enable **Maps JavaScript API** in Google Cloud.
- Restrict this key by **HTTP referrer**, allowing the Azure Static Web Apps domain and the final production domain.
- Do not use this public key on the backend.

### Google Places API (New)

Used for competitor search, relevant places, ratings, rating count, addresses, and place types.

Read:

- [Text Search (New)](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places/searchText), because the system calls `places:searchText`.
- [Places API (New) overview](https://developers.google.com/maps/documentation/places/web-service/op-overview)

Configure:

- `GOOGLE_MAPS_SERVER_API_KEY` or `GOOGLE_PLACES_API_KEY`
- Enable **Places API** in Google Cloud.
- Allow **Places API** in the key's API restrictions.
- Use a key separate from the browser key.
- Do not apply HTTP referrer restrictions to this server-side key; if you want restrictions, use mechanisms appropriate for server calls.
- Check billing, quotas, and Google Cloud logs.

### LocationIQ

Used for geocoding addresses and ZIP/postal codes when configured.

Read:

- [LocationIQ documentation](https://docs.locationiq.com/docs/choose-the-right-api)
- [LocationIQ API reference](https://api-reference.locationiq.com/)

Configure:

- `LOCATIONIQ_API_KEY`
- `LOCATIONIQ_MONTHLY_FREE_QUOTA` or `LOCATIONIQ_MONTHLY_BUDGET`, if you want usage limits.

### OpenRouteService

Used for driving distance and estimated time when configured; otherwise, the application uses straight-line distance.

Read:

- [OpenRouteService Matrix Endpoint](https://giscience.github.io/openrouteservice/v8.2.0/api-reference/endpoints/matrix/)

Configure:

- `ORS_API_KEY`
- `ORS_MONTHLY_FREE_QUOTA` or `ORS_MONTHLY_BUDGET`, if you want usage limits.

### OpenAI API

Used for optional enrichment of recommendations, positioning, personas, and the action plan.

Read:

- [OpenAI API pricing](https://platform.openai.com/docs/pricing)
- [OpenAI API rate limits](https://help.openai.com/en/articles/5955598)

Configure:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_MONTHLY_BUDGET`, remembering that the internal guard counts calls, not exact token cost.

### Public CNPJ and ZIP/Postal Code Sources

Used for company registration data, address, company ZIP/postal code, and customer ZIP/postal code normalization when uploaded.

Read:

- [ReceitaWS Developers](https://developers.receitaws.com.br/)
- [OpenCNPJ](https://opencnpj.com/)
- [ViaCEP](https://viacep.com.br/)
- [BrasilAPI CNPJ](https://brasilapi.com.br/docs#tag/CNPJ)

Configure:

- ViaCEP does not require a key.
- Use database cache to reduce repeated calls.
- Configure conservative limits with `CNPJ_PUBLIC_MONTHLY_BUDGET` and `VIACEP_MONTHLY_BUDGET`, if needed.

### Nominatim and Overpass

Used as legacy fallback for geocoding and OpenStreetMap-based places. The main report map now uses Google Maps.

Read:

- [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/)
- [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)

Configure:

- Use as fallback, not as a high-volume source.
- Configure `NOMINATIM_MONTHLY_BUDGET` and `OVERPASS_MONTHLY_BUDGET`, if you want additional guards.

## Quota and Cost Controls

The application includes two types of limits:

- `ANALYSIS_RATE_LIMIT_PER_HOUR` limits how many analyses each user can start per hour.
- `*_MONTHLY_FREE_QUOTA`, `*_MONTHLY_BUDGET`, `MONTHLY_BUDGET_PERCENT`, and `MONTHLY_BUDGET_ENABLED` limit global monthly calls to external APIs.

To stay around 60% of a provider's free tier, check the current limit in the provider dashboard and configure the real values for your project:

```env
MONTHLY_BUDGET_ENABLED=true
MONTHLY_BUDGET_PERCENT=60
GOOGLE_PLACES_MONTHLY_FREE_QUOTA=<monthly_google_places_limit>
LOCATIONIQ_MONTHLY_FREE_QUOTA=<monthly_locationiq_limit>
ORS_MONTHLY_FREE_QUOTA=<monthly_openrouteservice_limit>
OPENAI_MONTHLY_BUDGET=<monthly_openai_call_limit>
```

You can also provide the already calculated direct budget:

```env
GOOGLE_PLACES_MONTHLY_BUDGET=<60_percent_google_places_limit>
LOCATIONIQ_MONTHLY_BUDGET=<60_percent_locationiq_limit>
ORS_MONTHLY_BUDGET=<60_percent_openrouteservice_limit>
```

The monthly counter is stored in the `UserRateLimit` table using a technical system key, without creating a new table. When the configured limit is reached, the external call is blocked and the analysis uses fallback behavior when available, such as cache, straight-line distance, Nominatim, or local recommendations.

For public sources without keys, such as CNPJ, ViaCEP, Nominatim, and Overpass, there is no single universal monthly free-tier variable. If you want to be conservative, configure direct limits such as `CNPJ_PUBLIC_MONTHLY_BUDGET`, `VIACEP_MONTHLY_BUDGET`, `NOMINATIM_MONTHLY_BUDGET`, and `OVERPASS_MONTHLY_BUDGET`.

Important: free limits change over time and vary by account, project, API, SKU, and billing configuration. The application does not hardcode these numbers as absolute truth. Configure values according to the current Google Cloud, LocationIQ, OpenRouteService, and OpenAI dashboards. For OpenAI, the application guard counts calls, not tokens or exact financial cost; also use the provider's billing controls.

## Temporary Uploads in Azure Blob

The CSV/XLSX file with ZIP/postal codes is read in the browser, and only ZIP/postal codes are sent to the analysis. When Azure Blob Storage is configured, the application also uploads the file to a temporary container through `/api/blob/upload`.

The upload goes through the server to avoid browser CORS issues. The old `/api/blob/sas` route still exists for compatibility, but the main screen no longer depends on direct browser upload to Blob Storage.

After the analysis completes successfully, `/api/blob/delete` deletes the temporary blob by the name generated by the application. As an extra operational safety layer, it is also recommended to configure a lifecycle rule in Azure Storage to delete old blobs from the temporary container if a session is interrupted before application cleanup.

## Google Places

Competitor search uses the new Places API:

```text
https://places.googleapis.com/v1/places:searchText
```

The key must be server-side in `GOOGLE_MAPS_SERVER_API_KEY` or `GOOGLE_PLACES_API_KEY`. The public `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY` is only for browser maps and must not be used by the backend to search competitors. The API must be enabled in Google Cloud and billing must be active.

Google Places queries are built from the business activity described by the user and the selected competitor types. When a CNPJ is provided, it helps locate an existing company and confirm registration data; when there is no CNPJ, the application uses the manually entered address as the radius center point. The registered CNAE does not define competitor searches.

Google Places does not return CNPJ directly. When a CNPJ is provided, to avoid listing the analyzed company as its own competitor, the application cross-checks Google results against the registration record using phone number, address, coordinates, website/email domain, name similarity, and, when the result website is available, scans the returned page for the company's CNPJ. Results identified as the same company are removed before the report is generated.

If diagnostics show `API_KEY_HTTP_REFERRER_BLOCKED`, the backend key is restricted by site/referrer. Create a separate server key, allow **Places API** in API restrictions, and do not apply HTTP referrer restrictions to that key. Then register it in Azure Static Web Apps and GitHub Secrets as `GOOGLE_MAPS_SERVER_API_KEY`, or replace `GOOGLE_PLACES_API_KEY`.

The application does not cache empty results when the Google key is missing. After the key is configured, the next analysis calls Google Places directly.

If competitors do not appear, verify:

- Places API is enabled in Google Cloud.
- Billing is active.
- Key restrictions allow Places API.
- Server key has no HTTP referrer restriction for `GOOGLE_MAPS_SERVER_API_KEY` or `GOOGLE_PLACES_API_KEY`.
- Usage quotas.
- Old cache in `PlacesCache`.
- `GOOGLE_PLACES_MAX_SEARCHES_PER_ANALYSIS` is not too low.
- Old empty results in `PlacesCache`. The application ignores new empty caches, but old records may still exist in the database.

## Running Locally

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

Open:

```text
http://localhost:3000/
```

## Deployment

Deployment runs through GitHub Actions in:

```text
.github/workflows/azure-static-web-apps.yml
```

The workflow requires this secret:

```text
AZURE_STATIC_WEB_APPS_API_TOKEN
```

To get the SWA token, replace the placeholders with your resource name and resource group:

```bash
az staticwebapp secrets list \
  --name <STATIC_WEB_APP_NAME> \
  --resource-group <RESOURCE_GROUP_NAME> \
  --query "properties.apiKey" \
  -o tsv
```

To confirm that the SWA is connected to the correct repository:

```bash
az staticwebapp show \
  --name <STATIC_WEB_APP_NAME> \
  --resource-group <RESOURCE_GROUP_NAME> \
  --query "{provider:provider, repo:repositoryUrl, branch:branch, hostname:defaultHostname}" \
  -o json
```

Expected result:

```json
{
  "provider": "GitHub",
  "repo": "https://github.com/<owner>/<repo>",
  "branch": "main",
  "hostname": "<default-hostname>.azurestaticapps.net"
}
```

## Troubleshooting

### The URL Shows the Default Azure Page

This means there has not been a valid deployment to the SWA yet. Check:

- The SWA is connected to the correct repository.
- The GitHub Actions workflow completed successfully.
- The `AZURE_STATIC_WEB_APPS_API_TOKEN` secret exists in the repository.
- The workflow uses `output_location: ""`, not `build`.
- The build finishes without errors.

### The Application Still Opens `/sign-in`

The current flow does not use login. `/sign-in` exists only for compatibility with old links and redirects to `/`. If the browser keeps opening `/sign-in`, clear cache or use the site root directly.

### Prisma Error During Build

Confirm that the build runs `prisma generate && next build && node scripts/prepare-standalone.js` and that `DATABASE_URL` is configured in GitHub Actions/Azure.

### Prisma OpenSSL Error in Production

If the message says Prisma was generated for `debian-openssl-1.1.x`, but Azure requires `debian-openssl-3.0.x`, confirm:

- `prisma/schema.prisma` has `binaryTargets = ["native", "debian-openssl-1.1.x", "debian-openssl-3.0.x"]`.
- Deployment ran after this change.
- `scripts/prepare-standalone.js` copied `node_modules/.prisma` and `node_modules/@prisma/client` into `.next/standalone/node_modules`.

### Azure Functions Publishing Failure

In hybrid Next.js apps, Azure Static Web Apps packages the dynamic part as a managed Function. If publishing fails in that step, check:

- `next.config.js` contains `output: 'standalone'`.
- The build runs `scripts/prepare-standalone.js` after `next build`.
- Middleware does not block `/.swa/health.html`.
- There is only one active deployment workflow in `.github/workflows`.

### Temporary Upload Fails

Confirm:

- `AZURE_STORAGE_CONNECTION_STRING`
- `AZURE_STORAGE_CONTAINER_NAME`

If these variables are not configured, the analysis can still continue with ZIP/postal codes processed locally.

## Security

- Do not paste tokens into commands with `--debug`, because logs may expose sensitive arguments.
- If a GitHub PAT is exposed, revoke it immediately and generate a new one.
- Secrets must stay in Azure Static Web Apps or GitHub Actions, never in the repository.
- `.env`, `.env.local`, `node_modules`, and `.next` must not be versioned.

## Methodological Limitations

- Google Places depends on key configuration, active billing, quotas, enabled APIs, and local data availability.
- ViaCEP does not provide income data.
- IBGE Localidades identifies city/state, but not neighborhood-level income.
- SIDRA requires table, variable, period, classification, and territorial level.
- PNAD is sample-based and usually does not provide neighborhood/ZIP-level granularity.
- 2022 Census data may enrich the analysis, but requires ETL with census tract data, territorial meshes, and geographic joins.

The initial economic indicators are operational estimates for decision support, not precise census statistics by ZIP/postal code.

## Prisma

This project uses **Prisma 6.19.3** pinned in `package.json` and `package-lock.json`.

Do not upgrade to Prisma 7 without adapting the project to the new `prisma.config.ts` format. In Prisma 7, `url = env("DATABASE_URL")` inside `schema.prisma` is no longer accepted.
