# Hackathon — Fullstack Setup

Stack de développement complète (front, API, PostgreSQL, IA) prête en moins de 15 minutes sur macOS, Windows et Linux.

## Stack

- **API** : Express + TypeScript (Node 24) sur PostgreSQL 17
- **Front** : Vite + TypeScript, servi sur le port 5173
- **IA** : Ollama local (`llama3.2:1b`), API compatible OpenAI

---

## Ce dont vous avez besoin

Trois logiciels, une fois par machine. Installez-les **avant** de cloner.

| Logiciel                                                 | Version | Lien                                                                            |
| -------------------------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| Docker Desktop (macOS, Windows) ou Docker Engine (Linux) | récente | https://www.docker.com/products/docker-desktop                                  |
| VS Code + extension **Dev Containers**                   | récente | https://code.visualstudio.com/ + extension `ms-vscode-remote.remote-containers` |
| Ollama                                                   | récente | https://ollama.com/download                                                     |

**Sous Windows** : activez **WSL 2** dans Docker Desktop (`Settings → General → Use WSL 2 based engine`). Clonez le projet **dans WSL**, pas sur `C:\` — les performances et les permissions sont bien meilleures.

**Sous Linux** : Ollama n'écoute par défaut que sur `127.0.0.1` et n'est pas visible depuis le conteneur. Voir la section [Dépannage](#l-ia-ne-répond-pas) à la fin.

---

## Démarrer en trois étapes

### 1. Télécharger le modèle d'IA (une fois)

Dans un terminal **de votre machine** (pas dans Docker, pas dans VS Code) :

```bash
ollama pull llama3.2:1b
```

Environ 1,3 Go. Si Ollama n'est pas lancé, démarrez-le d'abord (icône dans la barre des menus sous macOS, près de l'horloge sous Windows).

Vérifiez qu'il répond :

```bash
curl http://localhost:11434/v1/models
```

Attendu : un JSON contenant `"id":"llama3.2:1b"`.

### 2. Cloner et ouvrir dans le conteneur

```bash
git clone git@github.com:Hackathon-Adav/fullstack-setup.git
cd fullstack-setup
```

Ouvrez le dossier dans VS Code (`File → Open Folder`), puis :

- **F1** (ou `Ctrl+Shift+P` / `Cmd+Shift+P`)
- Tapez **`Dev Containers: Reopen in Container`**
- Entrée

La première construction prend **2 à 5 minutes** : elle télécharge l'image Node 24 + Debian, installe les dépendances (`npm ci`), et crée `api/.env` à partir de `api/.env.example`.

**Vous saurez que c'est prêt** quand le coin inférieur gauche de VS Code affiche :

```
>< Dev Container: Hackathon
```

### 3. Lancer

Dans le terminal de VS Code (`Terminal → New Terminal`) :

```bash
npm run dev
```

Attendu :

```
[api] API sur http://localhost:3000
[web] ➜  Local:   http://localhost:5173/
```

Ouvrez **http://localhost:5173** dans votre navigateur. Vous devez voir :

```
Hackathon
API OK · PostgreSQL 17.11 (Debian ...)
• Combien de temps dure le hackathon ? → Deux semaines.
• Quelle est la capitale de la France ? → Paris.
```

Tapez une question dans le formulaire (par exemple « Quelle est la capitale du Japon ? »), cliquez **Envoyer**. La réponse de l'IA s'affiche au bout de quelques secondes et **est enregistrée en base**.

---

## Vérifier que tout fonctionne

Dans un **second terminal** de VS Code (`+` dans le panneau Terminal) :

```bash
curl localhost:3000/api/health
# {"status":"ok","db":"PostgreSQL 17.11 (Debian ...)"}

curl localhost:3000/api/questions
# [{"id":2,"question":"Combien de temps dure le hackathon ?",...}]
```

Et dans le navigateur : http://localhost:5173 doit afficher les questions.

---

## Dépannage

### Le conteneur ne démarre pas

1. Vérifiez que Docker Desktop est lancé et que l'icône est stable.
2. `F1` → **`Dev Containers: Show Container Log`** pour voir l'erreur.
3. Si un conteneur `hackathon-dev-1` ou `hackathon-db-1` existe déjà mais bloque :
   - Ouvrez Docker Desktop → **Containers** → supprimez-les.
   - Puis `F1` → **`Dev Containers: Rebuild Container`**.

### `npm install` échoue avec `EPERM` (Husky)

Dans le terminal du conteneur :

```bash
rm -rf .husky/_ node_modules
npm install
```

### `api/.env` manquant

```bash
cp api/.env.example api/.env
```

Puis relancez `npm run dev`.

### L'IA ne répond pas

**Sous Windows et macOS** (Docker Desktop) : Ollama sur `127.0.0.1` est joignable depuis le conteneur via `host.docker.internal`. Vérifiez dans le terminal du conteneur :

```bash
curl http://host.docker.internal:11434/v1/models
```

Si `Connection refused` :

- Vérifiez qu'Ollama tourne sur la machine hôte : `ollama list` (terminal **hors** conteneur).
- Vérifiez que le modèle est téléchargé : `ollama pull llama3.2:1b`.

**Sous Linux** : Ollama n'écoute que sur `127.0.0.1` par défaut. Pour le rendre joignable depuis le conteneur :

```bash
sudo systemctl edit ollama.service
```

Ajoutez en haut du fichier :

```
[Service]
Environment="OLLAMA_HOST=0.0.0.0"
```

Puis :

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

> **Attention** : `0.0.0.0` expose Ollama sur le réseau local. Ne l'activez pas sur un Wi-Fi public.

### `ECONNREFUSED 127.0.0.1:3000` dans les logs Vite (au premier lancement)

C'est normal : Vite démarre avant l'API. Rechargez la page (F5) — l'erreur ne revient pas.

### La page reste sur « Connexion à l'API… »

- Vérifiez que `npm run dev` tourne toujours dans le terminal 1.
- Vérifiez que les ports `3000` et `5173` sont dans l'onglet **Ports** de VS Code (en bas).
- Ouvrez la console du navigateur (F12) et collez-moi l'erreur.

### `db/data` — permission refusée

Ce dossier appartient à l'utilisateur PostgreSQL du conteneur. Il est ignoré par git et par ESLint/Prettier. **Ne le supprimez pas à la main sous Windows** — utilisez Docker Desktop pour arrêter les conteneurs, ou `sudo rm -rf db/data` sous Linux/WSL.

---

## Commandes utiles

```bash
npm run dev              # API + front en parallèle
npm run dev -w api       # API seule
npm run dev -w web       # front seul
npm run build            # build de production (tsc + vite build)
npm run lint             # ESLint
npm run format           # Prettier (écrit)
npm run format:check     # Prettier (vérifie)
```

Base de données :

```bash
psql postgres://app:app@db:5432/app
psql postgres://app:app@db:5432/app -c "SELECT * FROM questions"
```

---

## Testé sur

| Machine     | Système     | Architecture | Testeur     | Durée       |
| ----------- | ----------- | ------------ | ----------- | ----------- |
| PC-ADAV     | Windows 11  | x86_64       | (à remplir) | (à remplir) |
| (à remplir) | (à remplir) | (à remplir)  | (à remplir) | (à remplir) |

Pour ajouter votre machine après un test réussi, ouvrez une Pull Request qui complète ce tableau.

---

## Documentation

- [`docs/DECISIONS.md`](docs/DECISIONS.md) — justification des choix techniques (stack, IA, budget, exclusions)

---

## Structure du dépôt

```
fullstack-setup/
├── .devcontainer/        Dockerfile + devcontainer.json (VS Code)
├── .github/              CODEOWNERS + workflows CI
├── .husky/               hook pre-commit (lint + format)
├── api/                  API Express + TypeScript
├── web/                  Front Vite + TypeScript
├── db/
│   ├── init/             schéma et données de test (versionnés)
│   └── data/             données PostgreSQL (ignoré par git)
├── docs/                 documentation détaillée
├── compose.yaml          services : dev, db
├── package.json          workspaces npm (racine)
└── README.md             ce fichier
```
