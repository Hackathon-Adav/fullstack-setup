# Décisions techniques

Ce fichier documente les choix structurants du projet et leur justification. Contexte : hackathon de deux semaines, équipe de quatre personnes, machines hétérogènes (Windows, macOS, Linux), aucune infrastructure cloud, budget zéro.

## Stack

| Couche | Choix                          | Alternative écartée                  |
| ------ | ------------------------------ | ------------------------------------ |
| API    | Express + TypeScript (Node 24) | NestJS, Fastify, FastAPI             |
| Front  | Vite + TypeScript              | Next.js, React avec CRA              |
| Base   | PostgreSQL 17                  | MySQL, SQLite, MongoDB               |
| IA     | Ollama local, `llama3.2:1b`    | API commerciale, Ollama en conteneur |

**API — Express.** Framework Node le plus documenté, avec le moins de concepts à apprendre (pas de décorateurs, pas de modules, pas de DI). Sur deux semaines, la valeur ajoutée de NestJS (structure imposée) est inférieure à son coût d'apprentissage. Fastify aurait été plus performant, mais le trafic de démo est négligeable et Express a plus d'exemples en cas de blocage.

**Front — Vite + TypeScript.** Démarrage en moins d'une seconde, proxy `/api` intégré qui évite toute configuration CORS, et build de production (`vite build`) en une commande. Next.js aurait ajouté du SSR et un routeur dont on n'a pas besoin pour un front qui consomme une API séparée.

**Base — PostgreSQL 17.** Version figée (`postgres:17`, jamais `latest`) pour garantir la parité dev / CI / prod. Support natif de `TIMESTAMPTZ` et de `GENERATED ALWAYS AS IDENTITY`, utilisés dans le schéma.

**Workspaces npm.** Un seul `npm ci` et un seul `npm run dev` pour toute la stack. Chaque workspace (`api/`, `web/`) garde ses dépendances et ses scripts `dev` et `build` : c'est le contrat. Changer de framework revient à changer le contenu d'un dossier, pas l'environnement.

## Dev container

Image `mcr.microsoft.com/devcontainers/typescript-node:24-trixie` : Node 24 sur Debian trixie, **exactement la même base** que la CI (`node:24-trixie`) et que la future image de production. C'est la parité la plus stricte possible entre les trois environnements.

Extensions VS Code imposées via `devcontainer.json` (ESLint, Prettier, GitHub PR) : toute l'équipe a le même outillage, ce qui élimine les écarts de formatage et les « ça marche chez moi ».

Le client PostgreSQL 17 (`psql`) est inclus dans l'image, pour se connecter à la base depuis le terminal du conteneur sans installer quoi que ce soit sur l'hôte.

**Adaptation au réseau HETIC** : la ligne `sed` du `Dockerfile` redirige les paquets Debian vers `ftp.fr.debian.org`, car le dépôt officiel est bloqué depuis le réseau de l'école. Hors de ce réseau, la ligne peut être retirée sans impact.

## Base de données

`postgres:17` figé. Le bind mount `./db/data` (plutôt qu'un volume anonyme) survit aux `Rebuild Container` : les données ne sont pas perdues à chaque modification du `Dockerfile`. Ce dossier est ignoré par git (fichiers binaires, propres à chaque machine et à la version de PostgreSQL).

Les scripts `db/init/001-schema.sql` et `db/init/002-seed.sql` sont joués par PostgreSQL **au premier démarrage**, quand `db/data` est vide. C'est le mécanisme standard de seed reproductible : toute l'équipe part des mêmes lignes de test.

Le `healthcheck` (`pg_isready -U app -d app`) combiné à `depends_on: condition: service_healthy` empêche l'API de démarrer avant que la base accepte les connexions. Sans cela, les premiers appels échouent en `ECONNREFUSED`.

Identifiants de dev `app / app` : ce ne sont pas des secrets, ils peuvent être dans le fichier. En production, ils viendront de l'hébergeur.

## Fournisseur d'IA

**Ollama local**, modèle `llama3.2:1b` (1,3 Go), API compatible OpenAI (`/v1/chat/completions`).

| Critère       | Ollama local           | API commerciale     | Ollama en conteneur          |
| ------------- | ---------------------- | ------------------- | ---------------------------- |
| Coût          | 0 €                    | à l'usage           | 0 €                          |
| Données       | restent en local       | quittent la machine | restent en local             |
| Vitesse       | 1 à 5 s sur CPU récent | rapide              | lent sans GPU                |
| Mise en place | installer Ollama       | clé API             | service de plus dans compose |

Le modèle 1 milliard de paramètres donne des réponses modestes mais suffisantes pour **tester la chaîne** (front → API → DB → IA). C'est l'objectif de l'environnement, pas de produire un chatbot de qualité.

Comme l'API est compatible OpenAI, la fonction `ask()` est **identique** pour Ollama, Mistral ou OpenAI. Seule la configuration `.env` change. C'est ce qui rend le plan B trivial.

**Plan B documenté dans `api/.env.example`** : basculer sur Mistral (`mistral-small-latest`) revient à changer trois lignes dans `api/.env`, sans toucher au code. Si Ollama tombe pendant la démo, la stack reste fonctionnelle en 30 secondes.

**Joignabilité** : depuis le conteneur, Ollama de l'hôte est atteint via `host.docker.internal:11434`. La directive `extra_hosts: host.docker.internal:host-gateway` dans `compose.yaml` rend cela possible **aussi sous Linux**, où Docker Desktop ne fait pas la redirection automatiquement. Sous Windows et macOS elle est sans effet mais inoffensive.

**Ollama en conteneur écarté** : Docker Desktop n'a pas accès au GPU du Mac, et sous Windows le GPU n'est accessible qu'avec une carte NVIDIA + NVIDIA Container Toolkit. Le modèle tournerait sur CPU, plusieurs fois plus lentement. L'option reste documentée dans le cours mais n'est pas activée.

## Budget

| Poste          | Coût    | Justification                             |
| -------------- | ------- | ----------------------------------------- |
| Dépôt GitHub   | 0 €     | Dépôt public, plan gratuit                |
| GitHub Actions | 0 €     | Minutes illimitées sur dépôt public       |
| Ollama         | 0 €     | Logiciel libre, modèle local              |
| Docker Desktop | 0 €     | Gratuit pour usage personnel et éducation |
| **Total**      | **0 €** |                                           |

**Plan B payant** : si bascule sur Mistral pour la démo finale, coût estimé ~0,10 € pour 100 appels de 500 jetons avec `mistral-small-latest`. Un plafond de dépenses sera configuré sur le compte fournisseur, et une clé dédiée à la démo (révocable séparément).

## Ce qui est exclu

| Outil                            | Pourquoi                                                                |
| -------------------------------- | ----------------------------------------------------------------------- |
| Kubernetes / Helm                | Overkill pour un dépôt unique et 4 développeurs                         |
| Redis / cache                    | Aucun point chaud identifié à cette échelle                             |
| OAuth / JWT                      | Un identifiant en dur suffit pour la démo                               |
| Monitoring (Prometheus, Grafana) | La CI et les logs Docker couvrent le besoin                             |
| Tests E2E (Playwright, Cypress)  | La CI valide lint + format + build ; les tests manuels couvrent la démo |
| CD (déploiement automatique)     | Pas d'hébergeur cible ; la CI construit, le déploiement reste manuel    |
| Application mobile               | Périmètre web uniquement                                                |

**Justification** : chaque outil ajouté doit être installé, appris et maintenu. Sur deux semaines, la valeur ajoutée de ces outils est inférieure à leur coût d'apprentissage et de maintenance.

## Écarts au cours (justifiés)

- **`no-undef` désactivé pour les fichiers `.ts`** dans `eslint.config.mjs` : recommandation officielle de `typescript-eslint`. TypeScript vérifie déjà les identifiants ; la règle produit des faux positifs sur les globals du navigateur (`document`, `fetch`) et de Node (`process`).
- **`!db/data` en argument CLI de Prettier plutôt que `.prettierignore`** : sous Linux, `db/data` appartient à l'utilisateur `postgres` (UID 999) et Prettier échoue avec `EACCES` **avant** d'appliquer le `.prettierignore`. L'exclusion en ligne de commande est appliquée par `fast-glob` avant tout scan.
- **`npm exec lint-staged` dans le hook au lieu de `npx`** : `npx` échoue avec `ETARGET` dans le conteneur pour des raisons de résolution de chemin. `npm exec` cible explicitement le binaire local.
- **`node --check eslint.config.mjs` puis `npm run build --workspaces`** : le `build` initial était un placeholder (aucun code applicatif). Il a été remplacé par le vrai build (`tsc` + `vite build`) à l'arrivée du monorepo.
- **`rm -rf .husky/_` dans `postCreateCommand`** : évite l'erreur `EPERM` causée par le conflit de permissions entre le volume monté (NTFS Windows) et l'utilisateur `node` du conteneur.
- **`.gitattributes` avec `* text=auto eol=lf`** : force LF partout, évite les diffs fantômes entre Windows (CRLF) et le conteneur (LF).
- **`actions/checkout@v4` et non `@v7`** : la version `v7` n'est pas publiée à la date du projet ; `v4` est la dernière stable.

## Sécurité

- `api/.env` est ignoré par git. `api/.env.example` ne contient que des valeurs de développement.
- Ollama reste sur `127.0.0.1` par défaut. `host.docker.internal` suffit sous Docker Desktop. Si `OLLAMA_HOST=0.0.0.0` est activé sous Linux, restreindre au réseau local et ne jamais exposer sur un Wi-Fi public.
- L'équipe `evaluation` a le rôle **Admin** sur l'organisation GitHub, nécessaire pour consulter les rulesets et l'historique des checks. Aucun accès en écriture au code n'est utilisé.
- `main` et `develop` sont protégées : PR obligatoire, approbation requise, check `qualite` bloquant, pas de force push, pas de suppression.
