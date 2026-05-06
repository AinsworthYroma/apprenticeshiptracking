# Apprenticeship Tracking - Paris Septembre 2026

Application web pour rechercher des offres d'alternance a Paris (objectif septembre 2026), suivre les candidatures, et generer des templates de lettre de motivation + accroche LinkedIn.

## Fonctionnalites

- Scraping multi-sources cote serveur (avec fallback en cas d'echec d'une source)
- Source officielle FR active : La Bonne Alternance (sans cle)
- Filtrage par ville et date de debut ciblee
- Liste des offres detectees
- Suivi des candidatures avec statuts
- Generation de templates personnalises en un clic

## Installation

```bash
npm install
```

## Lancement

```bash
npm run dev
```

Puis ouvrir http://localhost:3000

## Configuration minimale conseillee (partage prive)

Definis un mot de passe admin personnalise avant de partager le lien:

```bash
export CELEXTIME_ADMIN_PASSWORD="TonMotDePasseFort"
npm run dev
```

En production, si la variable n'est pas definie, le serveur affiche un avertissement et utilise le mot de passe par defaut.

## Lancement avec Python

Si tu preferes une commande unique:

```bash
python3 launch.py
```

Mode developpement (watch):

```bash
python3 launch.py --dev
```

## Notes importantes

- Le scraping depend de la structure HTML des sites cibles, qui peut changer.
- Certaines plateformes bloquent les robots : cette application continue de fonctionner avec les autres sources et un jeu d'offres de secours.
- Les donnees de suivi sont stockees dans le navigateur (localStorage).
