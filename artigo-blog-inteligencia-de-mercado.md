---
title: "Como criamos uma ferramenta de inteligência de mercado com IA, dados públicos e desenvolvimento web"
description: "Um projeto aplicado inspirado nos cursos App Developer, Inteligência Artificial e My Robot Business da My Robot Barra da Tijuca."
date: "2026-06-10"
repository: "https://github.com/ussantos/inteligencia-de-mercado"
demo: "https://gray-glacier-0dc52610f.7.azurestaticapps.net/"
---

# Como criamos uma ferramenta de inteligência de mercado com IA, dados públicos e desenvolvimento web

Existe uma diferença enorme entre aprender tecnologia como assunto abstrato e usá-la para construir uma solução que resolve um problema real. Foi com essa ideia que nasceu a aplicação **Inteligência de Mercado**, uma ferramenta web criada para apoiar estudos regionais de concorrência, oportunidade e posicionamento comercial.

O projeto foi desenvolvido como uma demonstração prática dos conceitos trabalhados nos cursos [App Developer](https://www.myrobotbarra.com.br/app-developer.html), [Inteligência Artificial](https://www.myrobotbarra.com.br/inteligencia-artificial.html) e [My Robot Business](https://www.myrobotbarra.com.br/my-robot-business.html), da My Robot Barra da Tijuca.

A aplicação está publicada em:

[https://gray-glacier-0dc52610f.7.azurestaticapps.net/](https://gray-glacier-0dc52610f.7.azurestaticapps.net/)

E o código-fonte está disponível em:

[https://github.com/ussantos/inteligencia-de-mercado](https://github.com/ussantos/inteligencia-de-mercado)

## A ideia: transformar perguntas de negócio em uma experiência digital

A pergunta inicial era simples:

> Como ajudar alguém a entender melhor uma região antes de abrir, posicionar ou ajustar um negócio?

Na prática, essa pergunta envolve várias outras:

- Quem são os concorrentes próximos?
- Que tipos de alternativas o cliente encontra na região?
- O endereço escolhido parece fazer sentido?
- O raio de atuação é pequeno, amplo ou saturado?
- Existem barreiras, oportunidades ou pontos de atenção?
- Que ações comerciais poderiam ser priorizadas?

Responder isso manualmente exige pesquisa, leitura de mapas, comparação de dados e algum raciocínio estratégico. A proposta da aplicação foi transformar esse processo em um fluxo guiado: o usuário informa o ramo de atividade, uma localização de referência, o raio de análise e, se já tiver uma empresa existente, pode informar também o CNPJ e CEPs de clientes.

A partir daí, o sistema organiza dados públicos, consulta APIs externas, monta um mapa regional, identifica concorrentes e gera um relatório com recomendações.

## O que veio do curso App Developer

O curso App Developer trabalha uma ideia essencial: aplicativos não são apenas telas bonitas. Um app precisa ter lógica, fluxo, interface, dados, testes, correções e melhoria contínua.

Esse projeto seguiu exatamente essa lógica.

Antes de escrever código, foi necessário pensar na jornada do usuário. A primeira versão era mais complexa: exigia login, colocava o CNPJ como ponto central e mostrava muitas informações técnicas. Com o tempo, a experiência foi sendo refinada para ficar mais simples de usar:

- o login deixou de ser obrigatório;
- o CNPJ passou a ser opcional;
- o usuário pode analisar uma empresa existente ou estudar um novo negócio;
- o campo principal passou a ser o ramo de atividade;
- os CEPs de clientes só aparecem quando fazem sentido;
- o relatório ficou mais direto e fácil de imprimir.

Esse processo representa bem uma prática importante de desenvolvimento: construir, testar, ouvir o comportamento real da aplicação e melhorar.

No lado técnico, o projeto usa **Next.js**, **React**, **TypeScript** e **Tailwind CSS** para criar a interface. A aplicação também possui rotas de API, validações de formulário, componentes reutilizáveis, mapa interativo, gráficos e relatório preparado para impressão em PDF.

Ou seja, ela não é apenas uma página estática. É uma aplicação web completa, com entrada de dados, processamento, integração com serviços externos e saída estruturada para o usuário.

## O que veio do curso de Inteligência Artificial

O curso de Inteligência Artificial da My Robot trabalha conceitos como IA generativa, Python, APIs, chatbots, agentes, dados, contexto e sistemas web. A aplicação de inteligência de mercado usa essa mesma mentalidade: a IA não aparece como enfeite, mas como parte de um fluxo maior.

Um ponto importante é que o sistema não depende apenas de uma pergunta solta feita para uma IA. Antes de chamar qualquer modelo, a aplicação estrutura o contexto:

- ramo de atividade informado pelo usuário;
- endereço ou CEP de referência;
- raio de análise;
- tipos de concorrentes escolhidos;
- concorrentes encontrados em fontes públicas;
- barreiras e oportunidades observadas;
- CEPs de clientes, quando enviados;
- limitações das APIs usadas.

Com esse contexto, a IA pode ajudar a melhorar recomendações, plano de ação, posicionamento e leitura estratégica. O objetivo é gerar algo mais útil do que uma resposta genérica.

Essa é uma lição central para qualquer projeto com IA: a qualidade da resposta depende muito da qualidade do contexto. A inteligência artificial funciona melhor quando recebe dados organizados, uma tarefa bem definida e limites claros.

## O que veio do curso My Robot Business

O curso My Robot Business aparece na parte estratégica da ferramenta. Não basta encontrar pontos no mapa: é preciso transformar esses sinais em leitura de negócio.

Por isso, a aplicação não tenta entregar apenas uma lista de concorrentes. Ela organiza a análise para ajudar o usuário a pensar em posicionamento, público, proposta de valor, barreiras de acesso, parcerias possíveis e próximos passos comerciais.

Essa visão é especialmente importante quando a pessoa ainda está estudando abrir uma empresa. Nesse caso, o sistema não exige CNPJ. Ele pede o nome pretendido, o endereço de referência e o ramo de atuação, porque a pergunta central deixa de ser “qual é o cadastro dessa empresa?” e passa a ser “esse negócio faz sentido nessa região?”.

A ferramenta também usa conceitos de planejamento ao sugerir ações práticas, hipóteses para testar e um Canvas Estratégico do Negócio. A ideia é aproximar tecnologia, IA e pensamento empreendedor em uma mesma experiência.

## Dados públicos, APIs e automação

O projeto também mostra como aplicações modernas geralmente nascem da combinação de várias fontes e serviços.

Entre os recursos usados estão:

- **Google Places API**, para buscar concorrentes e locais relevantes;
- **Google Maps JavaScript API**, para exibir o mapa da região;
- **LocationIQ** e fallback de geocodificação, para transformar endereços e CEPs em coordenadas;
- **OpenRouteService**, quando configurado, para apoio em rotas e distâncias;
- **PostgreSQL com Prisma**, para cache, histórico e compartilhamento;
- **Azure Blob Storage**, para upload temporário de arquivos;
- **Azure Static Web Apps**, para publicação da aplicação;
- **OpenAI API**, opcionalmente, para enriquecer recomendações.

O usuário não precisa ver toda essa complexidade. Para ele, a experiência deve parecer simples: preencher dados, iniciar a análise e receber um relatório.

Mas por trás disso existe automação: validação, normalização, consulta externa, tratamento de erros, organização de dados, geração de recomendações e preparação de um layout para impressão.

## LGPD e cuidado com dados

Mesmo sendo um projeto educacional, a aplicação foi pensada com atenção à privacidade.

O envio de CEPs de clientes é opcional e só aparece quando o usuário informa que já possui uma empresa. A orientação é enviar apenas CEPs, sem nomes, telefones, e-mails, CPF ou qualquer dado pessoal desnecessário. Quando uma planilha contém outras colunas, o sistema deve considerar apenas a informação necessária para a análise regional.

Além disso, arquivos enviados para processamento temporário podem ser removidos do armazenamento depois da análise. Essa decisão reforça uma ideia importante: tecnologia útil também precisa ser responsável.

## O relatório: menos ruído, mais interpretação

Uma parte importante do projeto foi perceber que relatório bom não é o relatório com mais informações. É o relatório que ajuda o usuário a decidir.

Por isso, a saída da aplicação foi sendo ajustada para reduzir redundâncias e explicar melhor cada seção. O relatório apresenta:

- resumo da região analisada;
- concorrentes relevantes ao redor;
- leitura de barreiras e oportunidades;
- recomendações práticas;
- mapa e gráficos;
- Canvas Estratégico do Negócio;
- plano de ação;
- observações sobre fontes públicas e limitações.

Quando o usuário não envia CEPs de clientes, a aplicação não força uma análise de afinidade ou bairros de clientes. Nesse caso, ela foca no que realmente existe: concorrentes e sinais de mercado ao redor da localização informada.

Essa escolha é importante porque evita confundir concorrência com base de clientes. Dados só devem ser usados quando representam aquilo que dizem representar.

## O aprendizado maior

Este projeto mostra que aprender desenvolvimento e IA não significa decorar ferramentas. Significa entender como transformar uma necessidade em uma solução.

Do lado do desenvolvimento, foi preciso pensar em interface, validação, responsividade, backend, banco de dados, deploy, impressão e manutenção.

Do lado da inteligência artificial, foi preciso pensar em contexto, qualidade dos dados, prompts, APIs, limites, custo e responsabilidade.

No fim, a ferramenta é uma ponte entre os três cursos:

- o **App Developer** aparece na construção da experiência, na lógica do sistema e na entrega de uma aplicação funcional;
- o curso de **Inteligência Artificial** aparece no uso de dados, APIs, contexto e recomendações assistidas por IA.
- o **My Robot Business** aparece na leitura estratégica, no posicionamento, no Canvas do negócio e na transformação dos dados em decisões comerciais.

O resultado é uma aplicação educacional, aberta para estudo, adaptação e melhoria.

## Links do projeto

- Aplicação publicada: [https://gray-glacier-0dc52610f.7.azurestaticapps.net/](https://gray-glacier-0dc52610f.7.azurestaticapps.net/)
- Repositório no GitHub: [https://github.com/ussantos/inteligencia-de-mercado](https://github.com/ussantos/inteligencia-de-mercado)
- Curso App Developer: [https://www.myrobotbarra.com.br/app-developer.html](https://www.myrobotbarra.com.br/app-developer.html)
- Curso Inteligência Artificial: [https://www.myrobotbarra.com.br/inteligencia-artificial.html](https://www.myrobotbarra.com.br/inteligencia-artificial.html)
- Curso My Robot Business: [https://www.myrobotbarra.com.br/my-robot-business.html](https://www.myrobotbarra.com.br/my-robot-business.html)

## Observação final

Este projeto tem caráter educativo. Ele não substitui análise profissional, validação jurídica, contábil, trabalhista, fiscal, técnica ou de proteção de dados. Qualquer organização que deseje usar, adaptar ou implantar a aplicação deve revisar o código, as configurações, as fontes de dados, os custos das APIs e as responsabilidades envolvidas.

Como exercício de aprendizagem, porém, ele mostra algo poderoso: quando desenvolvimento de aplicativos e inteligência artificial são ensinados de forma prática, os alunos deixam de ser apenas usuários de tecnologia e passam a entender como soluções digitais são pensadas, construídas, testadas e publicadas.
