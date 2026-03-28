const { BOARD_SPACES, TIDES_OF_FATE_DECK, NIYYAH_DECK } = require('./public/data');

const STARTING_MONEY = 1500;
const MAX_SEEDS = 20;

const rooms = {};

function initRoom(roomCode) {
    if (!rooms[roomCode]) {
        rooms[roomCode] = {
            code: roomCode,
            status: 'lobby',
            host: null,
            players: [],
            messages: [],
            board: new Array(40).fill(null).map(() => ({ ownerId: null, coOwnerId: null, houses: 0, isEndowment: false })),
            turnIndex: 0,
            barakahBowl: 0,
            commonWell: 0,
            doublesCount: 0,
            tofDeck: [...TIDES_OF_FATE_DECK].sort(() => Math.random() - 0.5),
            tofDiscard: [],
            niyyahDeck: [...NIYYAH_DECK].sort(() => Math.random() - 0.5),
            isGameOver: false,
            interaction: null // Describes blocking state: { title, desc, ... }
        };
    }
    return rooms[roomCode];
}

function getRoom(socket) {
    for (let c in rooms) {
        if (rooms[c].players.find(p => p.socketId === socket.id)) return rooms[c];
    }
    return null;
}

function broadcast(io, roomCode) {
    // Strip socket IDs before broadcasting
    const room = rooms[roomCode];
    if (!room) return;
    const safeState = JSON.parse(JSON.stringify(room));
    safeState.players.forEach(p => delete p.socketId);
    io.to(roomCode).emit('gameStateUpdate', safeState);
    handleBotTurn(io, room);
}

function handleBotTurn(io, room) {
    if (room.status !== 'playing' || room.isGameOver) return;
    
    // Check if the current required interaction/turn is a bot
    let activePlayer = room.players[room.turnIndex];
    if (!activePlayer.isBot) return;

    // VERY rudimentary bot logic. Let's execute immediately to avoid complex timeouts.
    setTimeout(() => {
        if (room.interaction) {
            // Pick the primary or only option
            let pBtn = room.interaction.buttons.find(b => b.primary);
            if (!pBtn) pBtn = room.interaction.buttons[0];
            if (pBtn) {
                handleAction(io, room, activePlayer, pBtn.actionId, pBtn.actionPayload);
            } else {
                room.interaction = null;
                broadcast(io, room.code);
            }
        } else {
            // Default turn action = roll
            if (room.doublesCount === 0 || !activePlayer.inReflection) {
                rollDice(io, room, activePlayer);
            } else {
                endTurn(io, room);
            }
        }
    }, 1500);
}

function logMsg(room, msg, colorStr) {
    room.messages.push({ msg, colorStr, id: Date.now() + Math.random() });
    if (room.messages.length > 20) room.messages.shift();
}

function setInteraction(room, title, desc, buttons) {
    room.interaction = { title, desc, buttons };
}

function addSeed(room) {
    room.barakahBowl++;
    logMsg(room, `1 Golden Seed added!`);
    if (room.barakahBowl >= MAX_SEEDS) triggerGameOver(room);
}

function triggerGameOver(room) {
    room.isGameOver = true;
    logMsg(room, "The Barakah Bowl is full! Calculating Legacy Scores...");
    setInteraction(room, "Game Over", "The Era of Prosperity has arrived.", []);
}

function rollDice(io, room, player) {
    if (room.interaction || room.isGameOver || player.id !== room.turnIndex) return;

    let d1 = Math.floor(Math.random() * 6) + 1;
    let d2 = Math.floor(Math.random() * 6) + 1;
    let isDoubles = d1 === d2;

    logMsg(room, `<strong style="color:${player.color}">${player.name}</strong> rolled ${d1} and ${d2}.`, player.color);

    if (player.inReflection) {
        if (isDoubles) {
            player.inReflection = false;
            player.reflectionTurns = 0;
            logMsg(room, `${player.name} rolled a Moment of Grace & leaves the Garden!`);
        } else {
            player.reflectionTurns++;
            if (player.reflectionTurns >= 3) {
                player.inReflection = false;
                player.reflectionTurns = 0;
                logMsg(room, `${player.name} leaves reflection after 3 turns.`);
            } else {
                endTurn(io, room);
                return;
            }
        }
    } else {
        if (isDoubles) {
            room.doublesCount++;
            if (room.doublesCount === 3) {
                player.position = 10;
                player.inReflection = true;
                addSeed(room);
                room.doublesCount = 0;
                endTurn(io, room);
                return;
            }
        } else {
            room.doublesCount = 0;
        }
    }

    let nextPos = (player.position + d1 + d2) % 40;
    if (nextPos < player.position && !player.inReflection) {
        player.dirhams += 200;
        logMsg(room, `${player.name} passed Gate, collects D200.`);
    }
    
    player.position = nextPos;
    resolveSpace(io, room, player, nextPos);
}

function resolveSpace(io, room, player, index) {
    let space = BOARD_SPACES[index];
    let bState = room.board[index];

    if (space.type === 'tides') {
        if (room.tofDeck.length > 0) {
            let card = room.tofDeck.pop();
            logMsg(room, `${player.name} drew: ${card.name}`);
            setInteraction(room, card.name, card.desc, [{ label: "Acknowledge", actionId: "endTurn", primary: true }]);
        } else {
            endTurn(io, room);
        }
    } else if (space.type === 'charity') {
        setInteraction(room, "Charity", space.desc, [{ label: "Pay", actionId: "payWell", actionPayload: space.amount, primary: true }]);
    } else if (space.type === 'oasis') {
        endTurn(io, room);
    } else if (space.type === 'go_to_reflection') {
        player.inReflection = true;
        player.position = 10;
        endTurn(io, room);
    } else if (space.type === 'district' || space.type === 'station' || space.type === 'utility') {
        if (bState.ownerId === null) {
            if (player.dirhams >= space.price) {
                setInteraction(room, "Unowned Property", `Buy ${space.name} for D${space.price}?`, [
                    { label: "Invest", actionId: "buyProperty", primary: true },
                    { label: "Auction", actionId: "auctionProperty", primary: false }
                ]);
            } else {
                // Auto auction
                setInteraction(room, "Cannot Afford", "Starting auction...", [{ label: "OK", actionId: "auctionProperty", primary: true }]);
            }
        } else if (bState.ownerId !== player.id) {
            let owner = room.players.find(p => p.id === bState.ownerId);
            setInteraction(room, "Rent Owed", `Pay D${space.baseRent} to ${owner.name}?`, [
                { label: "Pay", actionId: "payRent", primary: true },
                { label: "Waive Fee (Take Seed)", actionId: "waiveRent", primary: false }
            ]);
        } else {
            endTurn(io, room);
        }
    } else {
        endTurn(io, room);
    }
    broadcast(io, room.code);
}

function endTurn(io, room) {
    room.interaction = null;
    if (room.doublesCount === 0) {
        room.turnIndex = (room.turnIndex + 1) % room.players.length;
    }
    logMsg(room, `--- ${room.players[room.turnIndex].name}'s Turn ---`, 'white');
    broadcast(io, room.code);
}

function handleAction(io, room, player, actionId, payload) {
    let space = BOARD_SPACES[player.position];
    let bState = room.board[player.position];

    if (actionId === 'endTurn') {
        endTurn(io, room);
    } 
    else if (actionId === 'payWell') {
        player.dirhams -= payload;
        room.commonWell += payload;
        logMsg(room, `${player.name} paid well D${payload}.`);
        endTurn(io, room);
    } 
    else if (actionId === 'buyProperty') {
        player.dirhams -= space.price;
        bState.ownerId = player.id;
        logMsg(room, `${player.name} bought ${space.name}.`);
        endTurn(io, room);
    } 
    else if (actionId === 'auctionProperty') {
        // Simulating the auction as 'skipped' for simple bots layout
        logMsg(room, `Auction for ${space.name} skipped (in dev).`);
        endTurn(io, room);
    } 
    else if (actionId === 'payRent') {
        let owner = room.players.find(p => p.id === bState.ownerId);
        player.dirhams -= space.baseRent;
        owner.dirhams += space.baseRent;
        endTurn(io, room);
    }
    else if (actionId === 'waiveRent') {
        let owner = room.players.find(p => p.id === bState.ownerId);
        owner.gratitudeTokens++;
        addSeed(room);
        endTurn(io, room);
    }
}

let playerCounter = 0;

module.exports = {
    handleConnection(io, socket) {
        // Handle Lobby Join/Create
        socket.on('joinRoom', ({ name, color, roomCode }) => {
            if (!roomCode) {
                roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
            }
            socket.join(roomCode);
            let room = initRoom(roomCode);
            
            let p = {
                id: playerCounter++,
                socketId: socket.id,
                name: name || "Guest",
                color: color,
                isBot: false,
                dirhams: STARTING_MONEY,
                position: 0,
                inReflection: false, reflectionTurns: 0,
                gratitudeTokens: 0,
                niyyahCards: []
            };
            
            // Initial Niyyah Deal
            for(let i=0; i<3; i++) {
                if(room.niyyahDeck.length > 0) p.niyyahCards.push(room.niyyahDeck.pop());
            }

            if (room.players.length === 0) room.host = socket.id;
            room.players.push(p);

            broadcast(io, roomCode);
        });

        socket.on('addBot', () => {
            let room = getRoom(socket);
            if(room && room.host === socket.id && room.status === 'lobby') {
                let p = {
                    id: playerCounter++,
                    socketId: null,
                    name: "Bot " + Math.floor(Math.random()*100),
                    color: "#999",
                    isBot: true,
                    dirhams: 1500, position: 0, inReflection: false, reflectionTurns: 0, gratitudeTokens: 0,
                    niyyahCards: []
                };
                for(let i=0; i<3; i++) {
                    if(room.niyyahDeck.length > 0) p.niyyahCards.push(room.niyyahDeck.pop());
                }
                room.players.push(p);
                broadcast(io, room.code);
            }
        });

        socket.on('startGame', () => {
            let room = getRoom(socket);
            if(room && room.host === socket.id) {
                room.status = 'playing';
                logMsg(room, `The Stewardship begins...`);
                broadcast(io, room.code);
            }
        });

        socket.on('rollDice', () => {
            let room = getRoom(socket);
            if (room) {
                let p = room.players.find(x => x.socketId === socket.id);
                if (p) rollDice(io, room, p);
            }
        });

        socket.on('submitAction', ({ actionId, payload }) => {
            let room = getRoom(socket);
            if (room) {
                let p = room.players.find(x => x.socketId === socket.id);
                if (p && room.interaction) {
                    handleAction(io, room, p, actionId, payload);
                }
            }
        });
    },
    handleDisconnect(io, socket) {
        let room = getRoom(socket);
        if (room) {
            let idx = room.players.findIndex(p => p.socketId === socket.id);
            if (idx !== -1) room.players.splice(idx, 1);
            if (room.players.length === 0) {
                delete rooms[room.code];
            } else {
                if (room.host === socket.id && !room.players[0].isBot) {
                    room.host = room.players[0].socketId; // transfer host
                }
                broadcast(io, room.code);
            }
        }
    }
};
