const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const gameLogic = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve frontend files
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

io.on('connection', (socket) => {
    console.log(`[+] User connected: ${socket.id}`);
    gameLogic.handleConnection(io, socket);

    socket.on('disconnect', () => {
        console.log(`[-] User disconnected: ${socket.id}`);
        gameLogic.handleDisconnect(io, socket);
    });
});

server.listen(PORT, () => {
    console.log(`Tides of Fate Multiplayer Server running on http://localhost:${PORT}`);
});
