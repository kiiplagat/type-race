# TypeRace

Typing race game: type to drive. Faster typing = faster car. A wrong key bleeds speed until you type the right one.

## Run
    npm install
    npm start        # http://localhost:8080

Open the URL on your phone (same Wi-Fi) or deploy it. Use "Add to Home Screen" to install it as an app.

## Modes
- Race the AI: works with no server (open public/index.html directly).
- Online PvP: needs server.js running. One player creates a room, the other joins with the 4-letter code.

## Difficulty
Edit `DIFF` at the top of the script in public/index.html:
- `speed`: marquee drift in px/s
- `ai`: AI typing speed in chars/s
- `wmin` / `wmax`: word length range

## Deploying
PvP uses WebSockets, so use a host that runs a long-lived Node process (Render, Railway, Fly.io).
Vercel serverless does not support WebSocket servers. You can host public/ on Vercel for AI mode only.
