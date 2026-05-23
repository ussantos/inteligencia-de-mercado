# Inteligência My Robot

Aplicação interna de análise de concorrência e inteligência de mercado para a **My Robot**, especializada em cursos extracurriculares de tecnologia para crianças e adolescentes de 5 a 17 anos.

A aplicação foi criada para ser publicada em um **Azure Static Web App separado** chamado `inteligencia` e acessada inicialmente pela URL padrão do Azure. Futuramente pode usar o subdomínio `inteligencia.myrobotbarra.com.br`.

## Escopo atual

- Consulta de unidade por CNPJ usando BrasilAPI, ReceitaWS e OpenCNPJ.
- Lista automática de CNAEs do CNPJ para orientar a análise.
- Seleção múltipla de tipos de concorrentes por checkboxes.
- Campo de raio de análise da unidade, com padrão de 8 km.
- Upload opcional de CSV/XLSX com CEPs de clientes atuais.
- Validação e normalização de CEPs.
- Geocodificação com LocationIQ Free e fallback Nominatim.
- Mapa Leaflet + OpenStreetMap apenas para visualização.
- Busca de concorrentes com **Google Places API**, incluindo avaliação por estrelas e número de avaliações.
- Análise de afinidade por bairro/região, obstáculos de matrícula e posicionamento da unidade pelo nome vindo do CNPJ.
- 6 personas combinando responsáveis e filhos, pois ambos influenciam a matrícula.
- Exportação PDF client-side com jsPDF/html2canvas.
- Exportação XLSX com SheetJS.
- Histórico e compartilhamento de análises.
- Clerk Auth para proteger `/internal/*`.

## Recursos e custo

O projeto prioriza recursos gratuitos ou planos gratuitos quando possível:

- Azure Static Web Apps Free.
- Neon Postgres Free.
- Clerk Free.
- OpenStreetMap para renderização do mapa.
- ViaCEP.
- BrasilAPI / ReceitaWS / OpenCNPJ.
- Nominatim.
- LocationIQ Free.
- OpenRouteService Free.

Atenção: Google Places API exige billing ativo no Google Cloud e pode gerar cobrança se ultrapassar o uso gratuito/cotas configuradas. Configure cotas baixas no Google Cloud e monitore uso. Azure Blob Storage pode gerar custo baixo. OpenAI API é opcional e pode gerar custo; a aplicação funciona sem `OPENAI_API_KEY` usando fallback local.

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

## Variáveis principais

Veja `.env.example`. Para concorrentes com avaliações do Google, configure:

```env
GOOGLE_PLACES_API_KEY=
GOOGLE_PLACES_MAX_SEARCHES_PER_ANALYSIS=24
```

Nunca commite `.env`, `.env.local`, `node_modules` ou `.next`.

## Deploy no Azure Static Web Apps

Fluxo recomendado:

```text
VS Code → GitHub → GitHub Actions → Azure Static Web Apps
```

Configuração do workflow:

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
rg-myrobot-market-intelligence
```

Região preferida:

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

Não use IP, não inclua `https://` e não inclua `/internal/market-intelligence` no DNS.

## Limitações metodológicas

- Google Places melhora muito a busca de concorrentes, mas depende de chave, billing ativo, cotas e disponibilidade de dados locais.
- ViaCEP não traz renda.
- IBGE Localidades identifica município/UF, mas não renda por bairro.
- SIDRA exige tabela, variável, período, classificação e nível territorial.
- PNAD é amostral e não costuma chegar a CEP/bairro.
- Censo 2022 exige ETL com setor censitário para granularidade fina.

Os indicadores econômicos iniciais são estimativas operacionais para apoio à decisão, não estatística censitária precisa por CEP.


## Correção importante: versão do Prisma

Este projeto usa **Prisma 6.19.3** fixado em `package.json` e `package-lock.json`.

Não atualize para Prisma 7 sem adaptar o projeto para o novo formato com `prisma.config.ts`.
No Prisma 7, `url = env("DATABASE_URL")` dentro de `schema.prisma` deixa de ser aceito, por isso este pacote fixa Prisma 6.19.3.

Após extrair esta versão sobre o projeto, rode no PowerShell:

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

Se preferir não apagar o `package-lock.json`, garanta que ele veio deste pacote e rode `npm ci`.
