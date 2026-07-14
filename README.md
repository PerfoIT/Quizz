# PERFO Quiz

Application web de quiz live type Kahoot, sobre et premium, concue pour un seminaire IA PERFO puis reutilisable en formation.

## Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript, Socket.IO
- Base de donnees: PostgreSQL
- ORM: Prisma
- Deploiement: Docker Compose

## Demarrage Docker

Copier les variables d'environnement si vous souhaitez les adapter:

```bash
cp .env.example .env
```

Puis lancer:

```bash
docker compose up -d --build
```

URLs locales:

- Host: http://localhost:3000/host
- Display: http://localhost:3000/display/XXXX
- Join: http://localhost:3000/join/XXXX

Le serveur initialise le schema Prisma avec `prisma db push`, seed le quiz de demonstration, puis demarre l'API.

## Configuration

Variables principales:

- `DATABASE_URL`: URL PostgreSQL utilisee par Prisma
- `PUBLIC_URL`: URL publique utilisee pour generer les QR codes
- `SERVER_PORT`: port expose par le serveur, par defaut `3001`
- `CLIENT_PORT`: port expose par le client, par defaut `3000`
- `CORS_ORIGIN`: origine autorisee par Socket.IO et Express
- `VITE_SERVER_URL`: URL API compilee dans le frontend Docker. Laisser vide pour utiliser le proxy Nginx du client.
- `ADMIN_EMAIL`: email du premier administrateur, par defaut `admin@perfo.local`
- `ADMIN_PASSWORD`: mot de passe du premier administrateur, par defaut `perfo-admin`
- `ADMIN_NAME`: nom du premier administrateur
- `AUTH_SECRET`: secret de signature des tokens de connexion

Pour un domaine derriere Nginx Proxy Manager ou Traefik, reglez typiquement:

```env
PUBLIC_URL=https://quiz.perfo.fr
CORS_ORIGIN=https://quiz.perfo.fr
VITE_SERVER_URL=https://api.quiz.perfo.fr
```

## Fonctionnement

1. L'animateur se connecte, ouvre `/host`, choisit un quiz accessible et cree une session.
2. L'ecran projete ouvre `/display/:sessionCode`.
3. Les participants scannent le QR code ou ouvrent `/join/:sessionCode`.
4. L'animateur demarre le quiz. Chaque participant peut modifier sa reponse jusqu'a la fin du chrono. Selon le mode du quiz, l'application passe automatiquement a la question suivante ou attend l'action de l'animateur.

## Administration

La connexion est disponible sur:

- Login: http://localhost:3000/login

La zone admin est disponible sur:

- Login: http://localhost:3000/admin/login
- Admin: http://localhost:3000/admin

Le premier administrateur est cree automatiquement au demarrage du serveur a partir de `ADMIN_EMAIL` et `ADMIN_PASSWORD`.

La zone admin est organisee en onglets:

- `Questions`: creation et consultation de la banque de questions
- `Quiz`: creation, consultation et modification des quiz existants
- `Historique`: consultation des sessions lancees et de leurs podiums
- `Utilisateurs`: creation de comptes formateurs/admins

Elle permet de creer des utilisateurs formateurs, une banque de questions, puis un quiz en selectionnant les questions de cette banque. Types prevus:

- `QCM`: reponses texte classiques
- `IMAGE`: question ou reponses avec URL d'image
- `OTHER`: format generique pour extensions futures

Le mot de passe est configure avec `ADMIN_PASSWORD`.

Les questions et quiz appartiennent a un utilisateur et peuvent etre:

- `PRIVATE`: visibles uniquement par leur createur
- `ORGANIZATION`: partages avec les autres formateurs

Des etiquettes peuvent etre ajoutees aux questions et quiz pour preparer les filtres et le rangement par thematique.

L'explication d'une question est optionnelle. Si elle est vide, la revelation affiche seulement la bonne reponse.

Chaque quiz peut utiliser un rythme:

- `AUTO`: passage automatique apres la revelation
- `MANUAL`: revelation automatique a la fin du chrono, puis passage manuel par l'animateur

Chaque session peut etre nommee depuis `/host` afin de la retrouver dans l'historique.

## Scoring

- Bonne reponse avant le seuil configure sur la question: `1000` points
- Bonne reponse apres ce seuil: `-100` points par seconde entamee
- Mauvaise reponse ou reponse hors delai: `0` point

Chaque question possede deux reglages distincts:

- `Duree question`: temps total disponible pour repondre
- `Decrement apres`: moment a partir duquel les points commencent a diminuer

## Developpement local

Backend:

```bash
cd server
npm install
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```

Frontend:

```bash
cd client
npm install
npm run dev
```

## Structure

```text
server/src/index.ts            API Express et Socket.IO
server/src/socket.ts           Evenements temps reel
server/src/services/           Logique session, scoring, snapshots
server/prisma/schema.prisma    Modele de donnees
client/src/pages/              Host, Display, Player
client/src/components/         Composants UI partages
```
