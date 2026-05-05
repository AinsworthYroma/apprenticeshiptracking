import type { ApprenticeshipOffer, UserProfile, JobFamily } from './types';

const JOB_FAMILY_FR: Record<JobFamily, string> = {
  marketing: 'le Marketing',
  finance: 'la Finance',
  rh: 'les Ressources Humaines',
  commerce: 'le Commerce',
  tech: 'la Technologie',
  communication: 'la Communication',
  logistique: 'la Logistique',
  juridique: 'le Droit des Affaires',
  conseil: 'le Conseil en Management',
};

const JOB_FAMILY_SKILLS: Record<JobFamily, string> = {
  marketing:
    "ma créativité, mon sens analytique et ma maîtrise des outils marketing digitaux",
  finance:
    "mes compétences en analyse financière, ma rigueur et ma maîtrise des outils de modélisation",
  rh: "mon sens de l’écoute, mon empathie et mes connaissances en droit du travail et gestion des talents",
  commerce:
    "mon goût du challenge commercial, mon sens de la négociation et mon orientation résultats",
  tech: "mes compétences techniques, ma curiosité pour les nouvelles technologies et ma capacité à résoudre des problèmes complexes",
  communication:
    "mes qualités rédactionnelles, ma créativité et ma capacité à adapter les messages aux différentes audiences",
  logistique:
    "mon sens de l’organisation, mon esprit d’analyse et ma capacité à optimiser les processus",
  juridique:
    "ma rigueur juridique, mes capacités d’analyse et ma maîtrise des fondamentaux du droit des affaires",
  conseil:
    "mes capacités analytiques, ma vision stratégique et ma capacité à créer de la valeur pour mes clients",
};

const JOB_FAMILY_MOTIVATION: Record<JobFamily, string> = {
  marketing:
    "créer des expériences mémorables pour les consommateurs et contribuer à la croissance des marques dans un environnement digital en constante évolution",
  finance:
    "contribuer à la prise de décisions stratégiques grâce à l’analyse financière et participer à la création de valeur pour l’entreprise",
  rh: "accompagner le développement des talents et contribuer à créer un environnement de travail épanouissant et performant",
  commerce:
    "développer des relations durables avec les clients et contribuer directement à la croissance commerciale de l’entreprise",
  tech: "concevoir et déployer des solutions technologiques innovantes qui transforment les usages et créent de la valeur",
  communication:
    "construire des récits de marque cohérents et engageants qui résonnent avec les audiences cibles",
  logistique:
    "optimiser les flux et contribuer à l’excellence opérationnelle tout en réduisant l’empreinte environnementale",
  juridique:
    "sécuriser les opérations de l’entreprise et accompagner sa croissance dans un cadre réglementaire maîtrisé",
  conseil:
    "résoudre des problèmes complexes et accompagner les organisations dans leur transformation pour maximiser leur impact",
};

export function generateCoverLetter(
  offer: ApprenticeshipOffer,
  profile: UserProfile
): string {
  const today = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const skillsText = JOB_FAMILY_SKILLS[offer.jobFamily];
  const motivationText = JOB_FAMILY_MOTIVATION[offer.jobFamily];
  const domainText = JOB_FAMILY_FR[offer.jobFamily];

  const userSkillsList =
    profile.skills.length > 0
      ? `Mes compétences en ${profile.skills.slice(0, 3).join(', ')} me permettront de contribuer rapidement à vos projets.`
      : '';

  return `${profile.firstName} ${profile.lastName}
${profile.email}${profile.phone ? `\n${profile.phone}` : ''}
${profile.linkedinUrl ? `${profile.linkedinUrl}` : ''}

${today}

Objet : Candidature pour le poste d’${offer.title} — Contrat d’Apprentissage

Madame, Monsieur,

Actuellement étudiant(e) en ${profile.program} à ${profile.school}, je suis à la recherche d’une alternance dans le domaine de ${domainText} pour ${offer.startDate}. La lecture de votre offre pour le poste d’${offer.title} au sein de ${offer.company} a immédiatement retenu mon attention et j’ai la conviction que ce poste correspond pleinement à mes aspirations professionnelles.

${offer.company} est un acteur reconnu dans son secteur : ${offer.companyDescription.split('.')[0]}. Votre dynamisme et vos ambitions de croissance sont pour moi une réelle source de motivation. Je souhaite contribuer à vos projets tout en développant mes compétences dans un environnement stimulant et exigeant.

Au cours de mon parcours académique à ${profile.school}, j’ai développé ${skillsText}. ${userSkillsList} Ma formation m’a appris à travailler en équipe, à être rigoureux(se) et à m’adapter rapidement à de nouveaux environnements — des qualités que je mettrai pleinement au service de votre équipe.

Ce qui me motive profondément, c’est ${motivationText}. Cette alternance représente pour moi une opportunité unique d’évoluer dans un cadre professionnel de premier plan, au contact d’experts qui pourront m’aider à progresser et à confirmer mon projet professionnel.

Je suis disponible pour un entretien à votre convenance et me tiens à votre disposition pour vous fournir tout document complémentaire (CV, relevés de notes, lettre de recommandation).

Dans l’attente de votre retour, je vous prie d’agréer, Madame, Monsieur, l’expression de mes salutations distinguées.

${profile.firstName} ${profile.lastName}`;
}
