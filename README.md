[WHAT IS THIS PROJECT]
A real-time multi-device interactive installation where users journey across three physical touchpoints — built in Unity, TouchDesigner, and a web browser. Each touchpoint is a different technology but all connect to the same server. Users register with their phone number, enter a word or statement at each touchpoint, and watch their combined statement build across the installation. User data persists across sessions via Firebase.

[HOW TO RUN IT LOCALLY]
- Clone the repository
- Run npm install inside the networking-stack folder
- Add your Firebase serviceAccountKey.json to the root folder
- For server.js replace the line const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); with const serviceAccount = require('./serviceAccountKey.json');
- For Unity: open the project, update the server URL in TouchpointManager.cs to ws://YOUR_IP:3000/ws and hit Play
- For TouchDesigner: open the project file, set WebSocket DAT address to ws://YOUR_IP/ws and port 3000 
- Run node server.js
- Open http://YOUR_IP:3000/display.html for the browser touchpoint
- Open http://YOUR_IP:3000/controller.html?tp=touchpoint-3 on a mobile device as the controller

- [TECH STACK]
- Node.js and Express — server and static file serving
- Socket.io — real-time browser communication
- ws — raw WebSocket for Unity and TouchDesigner
- Firebase Firestore — user data persistence
- Unity with NativeWebSocket — touchpoint 1
- TouchDesigner — touchpoint 2
- HTML/CSS/JavaScript — touchpoint 3 and controller

[HOW TO DEPLY ON RAILWAY]
- Push the repository to GitHub — ensure serviceAccountKey.json is in .gitignore
- Create a new Railway project and connect the GitHub repo
- Add FIREBASE_SERVICE_ACCOUNT as an environment variable in the Railway service — value is the entire contents of serviceAccountKey.json as a single line JSON string, generated with node -e "console.log(JSON.stringify(require('./serviceAccountKey.json')))"
- Railway deploys automatically on every push
- Update Unity server URL to wss://YOUR_RAILWAY_DOMAIN/ws
- Update TouchDesigner WebSocket DAT to address wss://YOUR_RAILWAY_DOMAIN port 443 path /ws
