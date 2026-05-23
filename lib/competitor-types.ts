export const COMPETITOR_TYPES = [
  'Todos',
  'Academias e escolas esportivas',
  'Centros culturais com oficinas para jovens',
  'Centros de educação maker',
  'Centros de reforço escolar',
  'Clubes esportivos e recreativos',
  'Colégios com programas de robótica ou tecnologia',
  'Condomínios com atividades extracurriculares',
  'Cursos preparatórios e pré-vestibulares',
  'Empresas de audiovisual, criação de conteúdo e edição de vídeo para jovens',
  'Empresas de cursos online',
  'Empresas de festas, eventos e experiências infantis/teen',
  'Escolas de artes e desenho',
  'Escolas de dança',
  'Escolas de games e desenvolvimento de jogos',
  'Escolas de idiomas',
  'Escolas de matemática e raciocínio lógico',
  'Escolas de música',
  'Escolas de programação',
  'Escolas de robótica educacional',
  'Escolas de teatro',
  'Escolas de tecnologia para crianças e adolescentes',
  'Escolas regulares com contraturno',
  'Espaços de recreação e entretenimento',
  'Franquias educacionais extracurriculares',
  'Lan houses, arenas gamer e espaços de e-sports',
  'Parques indoor e espaços de lazer em shopping'
] as const;

export type CompetitorType = (typeof COMPETITOR_TYPES)[number];

export const DEFAULT_COMPETITOR_TYPES: CompetitorType[] = ['Todos'];
export const DEFAULT_COMPETITOR_TYPE: CompetitorType = 'Todos';

export function isCompetitorType(value: string): value is CompetitorType {
  return (COMPETITOR_TYPES as readonly string[]).includes(value);
}

export interface CompetitorTypeConfig {
  type: Exclude<CompetitorType, 'Todos'>;
  terms: string[];
  googleQueries: string[];
  strategicCategoryHint: 'direto' | 'indireto' | 'barreira' | 'polo';
}

export const COMPETITOR_TYPE_CONFIGS: CompetitorTypeConfig[] = [
  { type: 'Academias e escolas esportivas', terms: ['academia','fitness','crossfit','esporte','futebol','natação','jiu-jitsu','judô','karatê'], googleQueries: ['academia infantil','escola esportiva infantil','natação infantil','futebol infantil','jiu jitsu infantil'], strategicCategoryHint: 'indireto' },
  { type: 'Centros culturais com oficinas para jovens', terms: ['centro cultural','oficina','artes','jovens','biblioteca','teatro'], googleQueries: ['centro cultural oficinas jovens','oficinas culturais crianças adolescentes','biblioteca oficinas jovens'], strategicCategoryHint: 'indireto' },
  { type: 'Centros de educação maker', terms: ['maker','fab lab','fablab','prototipagem','impressão 3d','cultura maker'], googleQueries: ['educação maker crianças','laboratório maker crianças','curso maker jovens'], strategicCategoryHint: 'direto' },
  { type: 'Centros de reforço escolar', terms: ['reforço','tutoria','aula particular','apoio escolar','kumon'], googleQueries: ['reforço escolar','aula particular crianças','kumon'], strategicCategoryHint: 'indireto' },
  { type: 'Clubes esportivos e recreativos', terms: ['clube','recreativo','esportivo','associação'], googleQueries: ['clube recreativo infantil','clube esportivo crianças','atividades infantis clube'], strategicCategoryHint: 'polo' },
  { type: 'Colégios com programas de robótica ou tecnologia', terms: ['colégio','escola','robótica','tecnologia','programação','steam','stem'], googleQueries: ['colégio robótica','escola programação robótica','escola tecnologia crianças'], strategicCategoryHint: 'barreira' },
  { type: 'Condomínios com atividades extracurriculares', terms: ['condomínio','residencial','atividades','club residencial'], googleQueries: ['condomínio atividades infantis','condomínio clube infantil','atividades extracurriculares condomínio'], strategicCategoryHint: 'polo' },
  { type: 'Cursos preparatórios e pré-vestibulares', terms: ['pré-vestibular','vestibular','enem','preparatório'], googleQueries: ['curso preparatório enem','pré vestibular','curso preparatório estudantes'], strategicCategoryHint: 'indireto' },
  { type: 'Empresas de audiovisual, criação de conteúdo e edição de vídeo para jovens', terms: ['audiovisual','vídeo','edição','conteúdo','creator','youtube','podcast','estúdio'], googleQueries: ['curso audiovisual jovens','curso edição de vídeo adolescentes','curso criação de conteúdo jovens'], strategicCategoryHint: 'indireto' },
  { type: 'Empresas de cursos online', terms: ['curso online','ead','aula online','plataforma de cursos'], googleQueries: ['curso online programação crianças','curso online robótica','curso online tecnologia jovens'], strategicCategoryHint: 'indireto' },
  { type: 'Empresas de festas, eventos e experiências infantis/teen', terms: ['festa','eventos','buffet infantil','experiência','teen','kids'], googleQueries: ['experiência infantil teen','buffet infantil atividades','eventos infantis tecnologia'], strategicCategoryHint: 'indireto' },
  { type: 'Escolas de artes e desenho', terms: ['artes','desenho','pintura','ilustração','atelier','quadrinhos'], googleQueries: ['escola de desenho crianças','curso de artes crianças','aula de desenho adolescentes'], strategicCategoryHint: 'indireto' },
  { type: 'Escolas de dança', terms: ['dança','ballet','balé','jazz','hip hop'], googleQueries: ['escola de dança infantil','ballet infantil','dança adolescentes'], strategicCategoryHint: 'indireto' },
  { type: 'Escolas de games e desenvolvimento de jogos', terms: ['games','jogos','unity','minecraft','roblox','e-sports'], googleQueries: ['curso de games crianças','desenvolvimento de jogos adolescentes','curso roblox minecraft'], strategicCategoryHint: 'direto' },
  { type: 'Escolas de idiomas', terms: ['inglês','idiomas','espanhol','language','wizard','ccaa','yázigi'], googleQueries: ['escola de inglês crianças','curso de idiomas infantil','inglês adolescentes'], strategicCategoryHint: 'indireto' },
  { type: 'Escolas de matemática e raciocínio lógico', terms: ['matemática','raciocínio lógico','lógica','kumon','olimpíada'], googleQueries: ['curso matemática crianças','raciocínio lógico crianças','kumon'], strategicCategoryHint: 'indireto' },
  { type: 'Escolas de música', terms: ['música','piano','violão','guitarra','bateria','canto'], googleQueries: ['escola de música infantil','aula de música crianças','aula de violão adolescentes'], strategicCategoryHint: 'indireto' },
  { type: 'Escolas de programação', terms: ['programação','coding','code','python','javascript','computação','app developer'], googleQueries: ['curso de programação crianças','escola de programação adolescentes','coding school kids'], strategicCategoryHint: 'direto' },
  { type: 'Escolas de robótica educacional', terms: ['robótica','robôs','robot','lego','arduino','steam','stem','maker'], googleQueries: ['escola de robótica educacional','curso de robótica crianças','robótica para adolescentes'], strategicCategoryHint: 'direto' },
  { type: 'Escolas de teatro', terms: ['teatro','drama','interpretação','artes cênicas'], googleQueries: ['escola de teatro infantil','aula de teatro crianças','teatro adolescentes'], strategicCategoryHint: 'indireto' },
  { type: 'Escolas de tecnologia para crianças e adolescentes', terms: ['tecnologia','crianças','adolescentes','kids','teen','robótica','programação','inteligência artificial'], googleQueries: ['escola de tecnologia crianças','curso tecnologia adolescentes','tecnologia para crianças'], strategicCategoryHint: 'direto' },
  { type: 'Escolas regulares com contraturno', terms: ['contraturno','integral','tempo integral','bilíngue','after school'], googleQueries: ['escola integral','colégio integral','escola contraturno','after school crianças'], strategicCategoryHint: 'barreira' },
  { type: 'Espaços de recreação e entretenimento', terms: ['recreação','entretenimento','playground','kids','brinquedo','diversão'], googleQueries: ['espaço de recreação infantil','entretenimento infantil','playground indoor'], strategicCategoryHint: 'indireto' },
  { type: 'Franquias educacionais extracurriculares', terms: ['franquia','educacional','curso','extracurricular','kids','school'], googleQueries: ['franquia educacional crianças','curso extracurricular crianças','escola extracurricular'], strategicCategoryHint: 'indireto' },
  { type: 'Lan houses, arenas gamer e espaços de e-sports', terms: ['lan house','arena gamer','gamer','e-sports','cyber','games'], googleQueries: ['arena gamer','lan house gamer','espaço esports jovens'], strategicCategoryHint: 'indireto' },
  { type: 'Parques indoor e espaços de lazer em shopping', terms: ['parque indoor','shopping','lazer','kids','brinquedoteca','park','play'], googleQueries: ['parque indoor infantil','brinquedoteca shopping','lazer infantil shopping'], strategicCategoryHint: 'polo' }
];

export function getActiveCompetitorTypes(selected: CompetitorType[] | CompetitorType | undefined): Exclude<CompetitorType, 'Todos'>[] {
  const list = Array.isArray(selected) ? selected : selected ? [selected] : DEFAULT_COMPETITOR_TYPES;
  if (!list.length || list.includes('Todos')) return COMPETITOR_TYPE_CONFIGS.map((item) => item.type);
  return list.filter((item): item is Exclude<CompetitorType, 'Todos'> => item !== 'Todos' && isCompetitorType(item));
}

export function getConfigsForCompetitorTypes(selected: CompetitorType[] | CompetitorType | undefined): CompetitorTypeConfig[] {
  const active = new Set(getActiveCompetitorTypes(selected));
  return COMPETITOR_TYPE_CONFIGS.filter((item) => active.has(item.type));
}

export function getConfigsForCompetitorType(selected: CompetitorType[] | CompetitorType | undefined): CompetitorTypeConfig[] {
  return getConfigsForCompetitorTypes(selected);
}
