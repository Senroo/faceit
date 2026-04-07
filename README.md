# FACEIT Discord Tracker

Bot Discord avec interface web locale pour suivre des joueurs FACEIT et envoyer une notification a la fin de chaque match.

## Fonctionnalites

- notifications Discord automatiques quand un nouveau match termine est detecte
- commandes texte Discord pour piloter le bot directement depuis un serveur
- dashboard web local pour voir l'etat du bot, les joueurs suivis et les derniers matchs
- stockage local en JSON, sans base de donnees

## Commandes Discord

Le prefixe par defaut est `!faceit`.

- `!faceit help`
- `!faceit status`
- `!faceit players`
- `!faceit add <pseudo>`
- `!faceit remove <pseudo>`
- `!faceit channel`
- `!faceit check`
- `!faceit test`

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
- `FACEIT_API_KEY`
- `PORT`
- `DISCORD_COMMAND_PREFIX`

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
- active l'intent `Message Content Intent`
- invite le bot sur ton serveur avec les permissions de lecture/envoi de messages
- utilise `!faceit channel` dans le salon souhaite pour definir le salon des notifications

## Configuration FACEIT

- cree une API key dans le portail developpeur FACEIT
- utilise une cle cote serveur pour garder le token prive dans `.env`
- le bot interroge l'endpoint officiel `GET /players/{player_id}/history` pour detecter les nouveaux matchs termines et `GET /matches/{match_id}/stats` pour enrichir la notification

## Notes

- quand tu ajoutes un joueur, le bot prend le dernier match connu comme point de depart pour eviter de spammer les anciens matchs
- si `DISCORD_BOT_TOKEN` ou `FACEIT_API_KEY` sont absents, le dashboard se lance quand meme, mais le suivi ne sera pas operationnel
- l'etat du bot est stocke dans `DATA_DIR/state.json`

## Deploiement Railway

Le projet est pret pour Railway avec `railway.toml` et un endpoint `GET /health`.

1. Cree un nouveau service Railway depuis ce repo.
2. Ajoute les variables Railway :
   - `PORT` sera fourni par Railway automatiquement
   - `DATA_DIR=/data`
   - `DISCORD_BOT_TOKEN=...`
   - `FACEIT_API_KEY=...`
   - `DISCORD_COMMAND_PREFIX=!faceit`
3. Attache un volume Railway monte sur `/data` pour conserver :
   - les joueurs suivis
   - le salon Discord configure
   - les matchs deja notifies
4. Deploie le service. Railway utilisera `npm start` et verifiera `/health`.

Sans volume Railway, le bot redemarrera bien, mais il pourra oublier son etat apres un redeploiement.

## Sources officielles utiles

- FACEIT Data API : https://docs.faceit.com/docs/data-api/data/
- FACEIT overview : https://docs.faceit.com/docs/data-api/
