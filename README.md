# FACEIT Discord Tracker

Bot Discord avec interface web locale pour suivre des joueurs FACEIT, mesurer leurs performances et envoyer une notification a la fin de chaque match.

## Fonctionnalites

- notifications Discord automatiques quand un nouveau match termine est detecte
- slash commands Discord avec `/faceit`
- dashboard web plus riche avec leaderboard, highlights, stats globales et cartes joueurs
- export de sauvegarde JSON depuis le dashboard
- stockage local en JSON, sans base de donnees

## Slash Commands Discord

Le bot enregistre une commande `/faceit` avec sous-commandes :

- `/faceit help`
- `/faceit status`
- `/faceit players`
- `/faceit leaderboard`
- `/faceit analyze nickname:<pseudo> membre:@joueur`
- `/faceit roast nickname:<pseudo> membre:@joueur`
- `/faceit add nickname:<pseudo>`
- `/faceit remove nickname:<pseudo>`
- `/faceit channel`
- `/faceit check`
- `/faceit test`

## Installation

1. Installer les dependances :

```bash
npm install
```

2. Copier le fichier d'exemple :

```bash
copy .env.example .env
```

3. Renseigner dans `.env` :

- `DATA_DIR`
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `FACEIT_API_KEY`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `APP_URL`
- `PORT`

4. Lancer le projet :

```bash
npm start
```

5. Ouvrir le dashboard :

```text
http://localhost:3000
```

## Configuration Discord

- cree un bot dans le portail Discord Developer
- invite le bot sur ton serveur avec les permissions de lecture/envoi de messages et embeds
- si tu renseignes `DISCORD_GUILD_ID`, les slash commands seront enregistrees instantanement sur ton serveur de test
- sinon le bot enregistre les commandes globalement et Discord peut prendre un peu de temps a les afficher
- utilise `/faceit channel` dans le salon souhaite pour definir le salon des notifications
- `/faceit add` importe aussi un lot d'anciens matchs pour alimenter le dashboard et le classement
- `/faceit analyze` lance une analyse humouristique du profil avec OpenRouter
- `/faceit roast` sort une version plus chambreuse et piquante du profil

## Configuration FACEIT

- cree une API key dans le portail developpeur FACEIT
- utilise une cle cote serveur pour garder le token prive dans `.env`
- le bot interroge l'endpoint officiel `GET /players/{player_id}/history` pour detecter les nouveaux matchs termines et `GET /matches/{match_id}/stats` pour enrichir la notification

## Notes

- quand tu ajoutes un joueur, le bot prend le dernier match connu comme point de depart pour eviter de spammer les anciens matchs
- si `DISCORD_BOT_TOKEN` ou `FACEIT_API_KEY` sont absents, le dashboard se lance quand meme, mais le suivi ne sera pas operationnel
- l'etat du bot est stocke dans `DATA_DIR/state.json`
- l'historique archive des matchs permet de calculer le leaderboard et les stats des joueurs
- le dashboard inclut aussi une zone analytics avec progression en points de performance
- le leaderboard Discord est formate en embed avec medals, forme recente et vibe plus arcade

## Deploiement Railway

Le projet est pret pour Railway avec `railway.toml` et un endpoint `GET /health`.

1. Cree un nouveau service Railway depuis ce repo.
2. Ajoute les variables Railway :
   - `PORT` sera fourni par Railway automatiquement
   - `DATA_DIR=/data`
   - `DISCORD_BOT_TOKEN=...`
   - `DISCORD_GUILD_ID=...` pour enregistrer les slash commands instantanement sur ton serveur
   - `FACEIT_API_KEY=...`
   - `OPENROUTER_API_KEY=...`
   - `OPENROUTER_MODEL=google/gemma-4-26b-a4b-it`
   - `APP_URL=https://ton-app.railway.app`
3. Attache un volume Railway monte sur `/data` pour conserver :
   - les joueurs suivis
   - le salon Discord configure
   - les matchs deja notifies
   - les stats archivees du dashboard
4. Deploie le service. Railway utilisera `npm start` et verifiera `/health`.

Sans volume Railway, le bot redemarrera bien, mais il pourra oublier son etat apres un redeploiement. Tu peux aussi telecharger une sauvegarde via le bouton du dashboard.

## Sources officielles utiles

- FACEIT Data API : https://docs.faceit.com/docs/data-api/data/
- FACEIT overview : https://docs.faceit.com/docs/data-api/
