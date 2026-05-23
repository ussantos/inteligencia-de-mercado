# InteligÃªncia My Robot

AplicaÃ§Ã£o interna de anÃ¡lise de concorrÃªncia e inteligÃªncia de mercado para a **My Robot**, especializada em cursos extracurriculares de tecnologia para crianÃ§as e adolescentes de 5 a 17 anos.

A aplicaÃ§Ã£o foi criada para ser publicada em um **Azure Static Web App separado** chamado `inteligencia` e acessada inicialmente pela URL padrÃ£o do Azure. Futuramente pode usar o subdomÃ­nio `inteligencia.myrobotbarra.com.br`.

## Escopo atual

- Consulta de unidade por CNPJ usando BrasilAPI, ReceitaWS e OpenCNPJ.
- Lista automÃ¡tica de CNAEs do CNPJ para orientar a anÃ¡lise.
- SeleÃ§Ã£o mÃºltipla de tipos de concorrentes por checkboxes.
- Campo de raio de anÃ¡lise da unidade, com padrÃ£o de 8 km.
- Upload opcional de CSV/XLSX com CEPs de clientes atuais.
- ValidaÃ§Ã£o e normalizaÃ§Ã£o de CEPs.
- GeocodificaÃ§Ã£o com LocationIQ Free e fallback Nominatim.
- Mapa Leaflet + OpenStreetMap apenas para visualizaÃ§Ã£o.
- Busca de concorrentes com **Google Places API**, incluindo avaliaÃ§Ã£o por estrelas e nÃºmero de avaliaÃ§Ãµes.
- AnÃ¡lise de afinidade por bairro/regiÃ£o, obstÃ¡culos de matrÃ­cula e posicionamento da unidade pelo nome vindo do CNPJ.
- 6 personas combinando responsÃ¡veis e filhos, pois ambos influenciam a matrÃ­cula.
- ExportaÃ§Ã£o PDF client-side com jsPDF/html2canvas.
- ExportaÃ§Ã£o XLSX com SheetJS.
- HistÃ³rico e compartilhamento de anÃ¡lises.
- Clerk Auth para proteger `/internal/*`.

## Recursos e custo

O projeto prioriza recursos gratuitos ou planos gratuitos quando possÃ­vel:

- Azure Static Web Apps Free.
- Neon Postgres Free.
- Clerk Free.
- OpenStreetMap para renderizaÃ§Ã£o do mapa.
- ViaCEP.
- BrasilAPI / ReceitaWS / OpenCNPJ.
- Nominatim.
- LocationIQ Free.
- OpenRouteService Free.

AtenÃ§Ã£o: Google Places API exige billing ativo no Google Cloud e pode gerar cobranÃ§a se ultrapassar o uso gratuito/cotas configuradas. Configure cotas baixas no Google Cloud e monitore uso. Azure Blob Storage pode gerar custo baixo. OpenAI API Ã© opcional e pode gerar custo; a aplicaÃ§Ã£o funciona sem `OPENAI_API_KEY` usando fallback local.

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

## VariÃ¡veis principais

Veja `.env.example`. Para concorrentes com avaliaÃ§Ãµes do Google, configure:

```env
GOOGLE_PLACES_API_KEY=
GOOGLE_PLACES_MAX_SEARCHES_PER_ANALYSIS=24
```

Nunca commite `.env`, `.env.local`, `node_modules` ou `.next`.

## Deploy no Azure Static Web Apps

Fluxo recomendado:

```text
VS Code â†’ GitHub â†’ GitHub Actions â†’ Azure Static Web Apps
```

ConfiguraÃ§Ã£o do workflow:

```yaml
app_location: /
api_location: ""
output_location: ""
app_build_command: "npm run build"
```

Nome do recurso Azure Static Web App:

```text
inteligencia
```

Resource Group sugerido:

```text
inteligencia
```

RegiÃ£o preferida:

```text
Brazil South
```

## DNS futuro

Para `inteligencia.myrobotbarra.com.br`, use CNAME:

```text
Tipo: CNAME
Host: inteligencia
Destino: hostname-padrao-do-azure.azurestaticapps.net
```

NÃ£o use IP, nÃ£o inclua `https://` e nÃ£o inclua `/internal/market-intelligence` no DNS.

## LimitaÃ§Ãµes metodolÃ³gicas

- Google Places melhora muito a busca de concorrentes, mas depende de chave, billing ativo, cotas e disponibilidade de dados locais.
- ViaCEP nÃ£o traz renda.
- IBGE Localidades identifica municÃ­pio/UF, mas nÃ£o renda por bairro.
- SIDRA exige tabela, variÃ¡vel, perÃ­odo, classificaÃ§Ã£o e nÃ­vel territorial.
- PNAD Ã© amostral e nÃ£o costuma chegar a CEP/bairro.
- Censo 2022 exige ETL com setor censitÃ¡rio para granularidade fina.

Os indicadores econÃ´micos iniciais sÃ£o estimativas operacionais para apoio Ã  decisÃ£o, nÃ£o estatÃ­stica censitÃ¡ria precisa por CEP.


## CorreÃ§Ã£o importante: versÃ£o do Prisma

Este projeto usa **Prisma 6.19.3** fixado em `package.json` e `package-lock.json`.

NÃ£o atualize para Prisma 7 sem adaptar o projeto para o novo formato com `prisma.config.ts`.
No Prisma 7, `url = env("DATABASE_URL")` dentro de `schema.prisma` deixa de ser aceito, por isso este pacote fixa Prisma 6.19.3.

ApÃ³s extrair esta versÃ£o sobre o projeto, rode no PowerShell:

```powershell
cd C:\Projetos\inteligencia
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
# extraia o ZIP novamente para restaurar o package-lock.json correto
npm ci
npx prisma generate
npm run typecheck
npm run build
```

Se preferir nÃ£o apagar o `package-lock.json`, garanta que ele veio deste pacote e rode `npm ci`.

