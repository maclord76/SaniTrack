# Sanitrack

Sanitrack est une application web progressive (PWA) de suivi personnel de la sante. Elle permet de centraliser des donnees de bien-etre et de sante saisies au quotidien, puis de les consulter sous forme de tableaux de bord, graphiques, tendances et syntheses par periode.

L'application fonctionne principalement cote navigateur : les donnees sont stockees localement avec IndexedDB, et peuvent etre exportees ou importees au format JSON.

## Fonctionnalites

- Tableau de bord de synthese
- Suivi du poids, de la taille et calcul de l'IMC
- Suivi de la pression arterielle
- Suivi des analyses sanguines avec saisie et affichage en mmol/L ou mg/dL (stockage normalisé en mmol/L)
- Suivi du sommeil
- Suivi de l'activite physique
- Journal nutritionnel
- Recherche alimentaire via Open Food Facts et donnees CIQUAL
- Consultation des indices polliniques
- Graphiques et tendances par periode
- Import et export des donnees en JSON
- Stockage local dans le navigateur

## Objectif

Sanitrack a pour objectif d'aider l'utilisateur a suivre ses indicateurs de sante dans le temps, sans dependre d'un service distant pour conserver ses donnees personnelles. L'application regroupe plusieurs dimensions du suivi quotidien afin de faciliter l'observation des evolutions, des habitudes et des tendances.

## Technologies

- React
- TypeScript
- Vite
- Tailwind CSS
- Dexie / IndexedDB
- Zustand
- React Hook Form
- Zod
- Recharts
- Vitest

## Structure du depot

```text
.
├── sanitrack-app/        # Application React/Vite
└── README.md
```

Les fichiers utilises par l'application se trouvent principalement dans `sanitrack-app/`.

## Fichiers importants

- `sanitrack-app/src/` : code source React et TypeScript
- `sanitrack-app/public/` : ressources publiques, donnees CIQUAL et images pollens
- `sanitrack-app/api/login.php` : proxy PHP pour l'authentification Atmo
- `sanitrack-app/api/pollen-proxy.php` : proxy PHP pour les donnees polliniques
- `sanitrack-app/public/api/upload.php` : endpoint PHP pour le partage/import temporaire
- `sanitrack-app/proxy-server.js` : proxy local utilise en developpement
- `sanitrack-app/package.json` : scripts et dependances du projet
- `sanitrack-app/package-lock.json` : verrouillage des versions npm

## Installation

```bash
cd sanitrack-app
npm install
```

## Lancement en developpement

```bash
npm run dev
```

Cette commande lance l'application Vite ainsi que le serveur proxy local utilise par certaines integrations.

## Build

```bash
npm run build
```

## Tests

```bash
npm test
```

## Donnees personnelles

Les donnees de suivi sont conservees localement dans le navigateur de l'utilisateur. Une fonctionnalite d'import/export JSON permet de sauvegarder ou restaurer les donnees.

## Nettoyage avant publication GitHub

Les fichiers et dossiers suivants sont generes localement ou servent uniquement au developpement ponctuel. Ils ne sont pas necessaires au fonctionnement du depot source :

- `sanitrack-app/node_modules/`
- `sanitrack-app/dist/`
- `sanitrack-app/*.tsbuildinfo`
- `sanitrack-app/vite.config.d.ts`
- `sanitrack-app/proxy-test.log`

Certains fichiers racine comme les scripts de nettoyage CIQUAL, les notes de travail ou les documents de reference peuvent etre conserves si le depot doit aussi documenter l'historique du projet. Pour un depot GitHub plus propre, ils peuvent etre deplaces dans un dossier `docs/` ou `tools/`.

## Statut

Projet personnel en cours de developpement.
