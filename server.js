const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const path = require('path');
const admin = require('firebase-admin');

console.log('ENV CHECK:', process.env.FIREBASE_SERVICE_ACCOUNT ? 'found' : 'undefined');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const wss = new WebSocket.Server({server,path:'/ws'});

const activeSessions = {};

app.use(express.static(path.join(__dirname,'public')));

//helper to broadcast to a specific touchpoint
function sendToTouchpoint(touchpointId, event, data){
    io.to(touchpointId).emit(event,data);
    //also forward to raw websockets clients registered to this touchpoint
    wss.clients.forEach(function(client){
        console.log('checking client:', client.touchpointId, '| readyState:', client.readyState, '| target:', touchpointId);
        if(client.readyState === WebSocket.OPEN && client.touchpointId === touchpointId){
            console.log('sending to raw client:',touchpointId);
            client.send(JSON.stringify({event,data}));
        }
    });
}

//handling raw websockets (unity and touchdesigner)
wss.on('connection',function(ws){
    console.log('raw websocket connected');

    ws.on('message',function(raw){
        const message = raw.toString();
        console.log("raw message received:",message)
        try{
            const msg = JSON.parse(message);
            if(msg.event === 'register-touchpoint'){
                ws.touchpointId = msg.touchpointId;
                console.log('touchpoint registered:',msg.touchpointId);
            }
        } catch(e) {
            console.log('raw message parse error:',e);
        }
    });

    ws.on('close',function(){
        console.log('raw websocket disconnected');
    });
});

//socket.io 
io.on('connection' ,function(socket){
    console.log('connected:',socket.id);

    //touchppint display joins its own room
    socket.on('register-touchpoint', function(touchpointId){
        socket.join(touchpointId);
        console.log('touchpoint registered for:',touchpointId);
    });

    //controller joings to a specific touchpoint using touchpointid
    socket.on('register-controller',function(touchpointId){

        //check if touchpoint is busy
        if(activeSessions[touchpointId]){
            socket.emit('touchpoint-busy');
            return;
        }
        //list touchpong as busy
        activeSessions[touchpointId] = socket.id;
        socket.touchpointId = touchpointId;
        console.log('controller registered for:', touchpointId);
    });

    // user lookup by phone number
    socket.on('lookup-user', async function(phone){
        const doc = await db.collection('users').doc(phone).get();
        if(doc.exists){
            socket.emit('user-found',doc.data());

            //tell the touchpoint who just checked in
            const userData = doc.data();
            const fullStatement = userData.visitOrder
            .map(id => userData.statements[id])
            .join(' ');

            sendToTouchpoint(socket.touchpointId, 'user-checkin',{
                username: userData.username,
                fullStatement,
                visitCount: userData.visitOrder.length,
                complete: userData.visitOrder.length >= 3
            });
        } else{
            socket.emit('user-not-found');
        }
    });

    //new user registeration 
    socket.on('register-user', async function(data){
        const {phone,username} = data;
        const userData = {
            username,
            statements: {},
            visitOrder: []
        };

        await db.collection('users').doc(phone).set(userData);
        socket.emit('user-registered', userData);

        sendToTouchpoint(socket.touchpointId, 'user-checkin',{
            username,
            fullStatement:'',
            visitCount: 0,
            completed: false
        });
    });

    //user submits statements/words at a touchpoint
    socket.on('submit-statement', async function(data){
        const {phone , touchpointId, statement} = data;
        const ref = db.collection('users').doc(phone);
        const doc = await ref.get();
        const userData = doc.data();

        //update statement for this touchpoint 
        userData.statements[touchpointId] = statement;

        //add to visit order if first time at this touchpoint
        if(!userData.visitOrder.includes(touchpointId)){
            userData.visitOrder.push(touchpointId);
        }

        await ref.update({
            [`statements.${touchpointId}`]:statement,
            visitOrder: userData.visitOrder
        });

        //build full statement by visit order
        const fullStatement = userData.visitOrder
        .map(id => userData.statements[id])
        .join(' ');

        const visitCount = userData.visitOrder.length;
        const completed = visitCount >= 3;

        //send updated state to the touchpoint display
        sendToTouchpoint(touchpointId, 'user-update', {
            username: userData.username,
            fullStatement,
            visitCount,
            completed
        });

        //confirm to controller
        socket.emit('statement-accepted',{
            fullStatement,
            visitCount,
            completed
        });
    });

    socket.on('disconnect',function(){
        const tp = socket.touchpointId;
        if(tp && activeSessions[tp] === socket.id){
            delete activeSessions[tp];
            console.log('touchpoint released:', tp);

            //tell display to go back to idle
            sendToTouchpoint(tp,'touchpoint-idle',{});
        }
        console.log('disconnected:',socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT,function(){
    console.log('server running on port '+PORT);
});