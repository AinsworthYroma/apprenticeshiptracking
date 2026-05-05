# ApprentiTrack 🎓

Un outil web conçu pour aider les étudiants de **Rennes School of Business** à trouver et suivre leurs candidatures en alternance à Paris.

## Fonctionnalités

### 📋 Listing des offres
- **25 offres d'alternance parisiennes** couvrant tous les secteurs
- **Recherche** par poste, entreprise ou mot-clé
- **Filtres** par :
  - Type d'entreprise (Startup, PME, Grand groupe, Secteur public, Cabinet de conseil)
  - Famille de métiers (Marketing, Finance, RH, Commerce, Tech, Communication, Logistique, Juridique, Conseil)
  - Crédibilité sur le marché (1 à 5 étoiles)
  - Durée (6 mois, 12 mois, 24 mois)
- **Tri** par date, crédibilité, salaire ou nom d'entreprise

### 🔍 Fiche offre détaillée
- Description complète du poste et profil recherché
- **Lettre de motivation générée automatiquement** et personnalisée (copiable en un clic)
- **Actualités récentes** de l'entreprise
- **Liste des alumni Rennes SB** travaillant dans l'entreprise

### 📊 Suivi des candidatures (Kanban)
- Marquer une offre comme : Intéressé(e) → Candidature envoyée → Entretien → Offre reçue → Refus
- Vue Kanban par statut
- Statistiques de suivi

### 👤 Profil personnalisé
- Renseigner ses informations (nom, école, programme, compétences)
- La lettre de motivation est automatiquement personnalisée avec ces informations

## Stack technique

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS v4**
- **localStorage** pour la persistance des données (côté client)

## Démarrage

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
npm run start
```
