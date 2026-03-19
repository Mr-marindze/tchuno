export type OfficialCategory = {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
};

export type LegacyCategoryMapping = {
  fromSlug: string;
  toSlug: string;
};

export const officialCategories: OfficialCategory[] = [
  {
    name: 'Canalização',
    slug: 'canalizacao',
    description: 'Instalação e reparação de sistemas de água e saneamento',
    sortOrder: 10,
  },
  {
    name: 'Eletricista',
    slug: 'eletricista',
    description: 'Instalações e manutenção elétrica residencial e comercial',
    sortOrder: 20,
  },
  {
    name: 'Reparações Domésticas',
    slug: 'reparacoes-domesticas',
    description: 'Pequenas reparações gerais para casa e apartamento',
    sortOrder: 30,
  },
  {
    name: 'Construção',
    slug: 'construcao',
    description: 'Serviços de construção, alvenaria e remodelação',
    sortOrder: 40,
  },
  {
    name: 'Pintura',
    slug: 'pintura',
    description: 'Pintura de interiores, exteriores e acabamentos',
    sortOrder: 50,
  },
  {
    name: 'Carpintaria',
    slug: 'carpintaria',
    description: 'Móveis sob medida, portas, janelas e estruturas em madeira',
    sortOrder: 60,
  },
  {
    name: 'Limpeza',
    slug: 'limpeza',
    description: 'Limpeza residencial, comercial e pós-obra',
    sortOrder: 70,
  },
  {
    name: 'Jardinagem',
    slug: 'jardinagem',
    description: 'Manutenção de jardins, relvados e espaços verdes',
    sortOrder: 80,
  },
  {
    name: 'Transporte & Mudanças',
    slug: 'transporte-mudancas',
    description: 'Mudanças locais, transporte de móveis e logística leve',
    sortOrder: 90,
  },
  {
    name: 'Montagem & Instalação',
    slug: 'montagem-instalacao',
    description: 'Montagem de móveis e instalação de equipamentos',
    sortOrder: 100,
  },
  {
    name: 'Refrigeração & AVAC',
    slug: 'refrigeracao-avac',
    description: 'Instalação e manutenção de ar condicionado e refrigeração',
    sortOrder: 110,
  },
  {
    name: 'Mecânica Automóvel',
    slug: 'mecanica-automovel',
    description: 'Diagnóstico e reparação de viaturas',
    sortOrder: 120,
  },
  {
    name: 'Beleza & Estética',
    slug: 'beleza-estetica',
    description: 'Serviços de beleza, cuidados pessoais e estética',
    sortOrder: 130,
  },
  {
    name: 'Serviços Domésticos',
    slug: 'servicos-domesticos',
    description: 'Apoio doméstico recorrente e serviços para o lar',
    sortOrder: 140,
  },
];

export const legacyCategoryMappings: LegacyCategoryMapping[] = [
  {
    fromSlug: 'eletricidade',
    toSlug: 'eletricista',
  },
];

