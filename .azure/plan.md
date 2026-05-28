# Plano Azure - Inteligencia de Mercado

Status: Alteracoes aplicadas. Validacao completa bloqueada por falha de instalacao de dependencias no npm local.

## Objetivo

Modernizar o projeto existente para ser uma aplicacao independente de inteligencia de mercado, preparada para Azure Static Web Apps, sem dependencia de marca, site ou dominio da My Robot.

## Diagnostico do projeto

- Aplicacao Next.js 15 com App Router, rotas API, Clerk, Prisma, Neon/Postgres, Azure Blob Storage e Leaflet.
- Ja existe `staticwebapp.config.json` com runtime Node 22 para APIs.
- A busca de concorrentes usa `services/google-places.ts`, mas existe codigo legado de Overpass.
- O README e textos do produto tinham acoplamento a marca, segmento e dominio especificos.
- Provavel causa da falha atual de concorrentes: quando nao ha chave Google, o servico grava cache vazio por 30 dias e reutiliza esse resultado mesmo depois que a chave e configurada.

## Alteracoes planejadas

1. Atualizar identidade, metadata, textos de interface, exportacoes e README para "Inteligencia de Mercado" generico.
2. Manter Azure Static Web Apps como alvo independente, sem subdominio ou acoplamento ao site da My Robot.
3. Corrigir Google Places para nao armazenar cache vazio quando a chave nao estiver configurada e para filtrar resultados pelo raio analisado.
4. Generalizar categorias de concorrentes e textos analiticos para qualquer tipo de negocio.
5. Ajustar prompt de IA para inteligencia de mercado B2B/B2C generica.
6. Criar `.env.example` sem segredos reais.
7. Validar com typecheck/build quando possivel.

## Seguranca e segredos

- Nenhum token informado pelo usuario sera gravado no repositorio.
- Variaveis sensiveis devem ser configuradas localmente em `.env.local` e no portal/segredos do Azure Static Web Apps.

## Servicos Azure

- Azure Static Web Apps `inteligencia` no resource group `inteligencia`, regiao `East US 2`, SKU Free.
- Azure Blob Storage opcional para upload temporario.
- Banco Postgres externo existente via `DATABASE_URL`.

## Configuracao de deploy aplicada

- Runtime Node alinhado para 22.x no `package.json` e `staticwebapp.config.json`.
- `next.config.js` sem `output: standalone`, pois o destino e Azure Static Web Apps, nao container/App Service.
- `npm run build` executa `prisma generate && next build`.
- Workflow GitHub Actions usa `Azure/static-web-apps-deploy@v1`, `app_location: /`, `api_location: ""`, `output_location: ""`.
- Deploy esperado via secret `AZURE_STATIC_WEB_APPS_API_TOKEN`, obtido da instancia SWA `inteligencia`.

## Validacao

- `npm run typecheck`
- `npm run build`

Resultado local:

- `git diff --check`: sem erros de whitespace.
- Busca por segredos reais no repositorio: nenhum token informado pelo usuario foi encontrado.
- `npm install`/`npm ci`: bloqueado por timeouts do gateway de pacotes e erro interno do npm `Exit handler never called`.
- `tsc --noEmit`: nao concluiu porque a instalacao parcial ficou sem varios pacotes `@types`; o `node_modules` parcial foi removido.
