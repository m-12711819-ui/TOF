const { BOARD_SPACES, TIDES_OF_FATE_DECK, NIYYAH_DECK } = require('./public/data');

const STARTING_MONEY = 1500;
const MAX_SEEDS = 20;
const MAX_PLAYERS = 4;
const HOUSE_COST = 100;
const ENDOWMENT_COST = 180;
const MIN_AUCTION_PRICE_FACTOR = 0.5;

const rooms = {};
let playerCounter = 0;

function initRoom(roomCode) {
    if (!rooms[roomCode]) {
        rooms[roomCode] = {
            code: roomCode,
            status: 'lobby',
            host: null,
            players: [],
            messages: [],
            board: new Array(40).fill(null).map(() => ({
                ownerId: null,
                coOwnerId: null,
                houses: 0,
                isEndowment: false
            })),
            turnIndex: 0,
            barakahBowl: 0,
            commonWell: 0,
            doublesCount: 0,
            lastRoll: null,
            turnPhase: 'roll',
            tofDeck: shuffle([...TIDES_OF_FATE_DECK]),
            tofDiscard: [],
            niyyahDeck: shuffle([...NIYYAH_DECK]),
            isGameOver: false,
            interaction: null,
            auction: null
        };
    }
    return rooms[roomCode];
}

function shuffle(arr) {
    return arr.sort(() => Math.random() - 0.5);
}

function getRoom(socket) {
    for (const code in rooms) {
        if (rooms[code].players.find((p) => p.socketId === socket.id)) return rooms[code];
    }
    return null;
}

function getActivePlayer(room) {
    return room.players[room.turnIndex];
}

function findPlayerBySocket(room, socketId) {
    return room.players.find((p) => p.socketId === socketId);
}

function getPlayerNetWorth(room, player) {
    const ownedValue = room.board.reduce((total, entry, index) => {
        const space = BOARD_SPACES[index];
        if (!space.price) return total;
        if (entry.ownerId === player.id) total += space.price;
        if (entry.coOwnerId === player.id) total += Math.floor(space.price / 2);
        total += entry.ownerId === player.id ? entry.houses * HOUSE_COST : 0;
        total += entry.ownerId === player.id && entry.isEndowment ? ENDOWMENT_COST : 0;
        return total;
    }, 0);

    const niyyahValue = player.niyyahCards.reduce((sum, card) => sum + card.bonus, 0);
    return player.dirhams + ownedValue + player.gratitudeTokens * 30 + niyyahValue;
}

function getSortedScoreboard(room) {
    return room.players
        .map((player) => ({
            id: player.id,
            name: player.name,
            color: player.color,
            gratitudeTokens: player.gratitudeTokens,
            niyyahCards: player.niyyahCards,
            score: getPlayerNetWorth(room, player)
        }))
        .sort((a, b) => b.score - a.score);
}

function createPlayer(name, color, socketId, isBot = false) {
    return {
        id: playerCounter++,
        socketId,
        name: name || (isBot ? `Bot ${Math.floor(Math.random() * 100)}` : 'Guest'),
        color: color || '#999999',
        isBot,
        dirhams: STARTING_MONEY,
        position: 0,
        inReflection: false,
        reflectionTurns: 0,
        gratitudeTokens: 0,
        niyyahCards: [],
        showNiyyahUI: false,
        skippedTurns: 0
    };
}

function drawNiyyahCards(room, player, count = 3) {
    for (let i = 0; i < count; i++) {
        if (room.niyyahDeck.length === 0) {
            room.niyyahDeck = shuffle([...NIYYAH_DECK]);
        }
        if (room.niyyahDeck.length > 0) {
            player.niyyahCards.push(room.niyyahDeck.pop());
        }
    }
}

function logMsg(room, msg, colorStr) {
    room.messages.push({ msg, colorStr, id: Date.now() + Math.random() });
    if (room.messages.length > 50) room.messages.shift();
}

function setInteraction(room, title, desc, buttons, targetPlayerId = null, meta = {}) {
    room.interaction = { title, desc, buttons, targetPlayerId, ...meta };
}

function clearInteraction(room) {
    room.interaction = null;
}

function addSeed(room, amount = 1) {
    room.barakahBowl += amount;
    logMsg(room, `${amount} Golden Seed${amount > 1 ? 's' : ''} added to the Barakah Bowl.`, 'var(--gold)');
    if (room.barakahBowl >= MAX_SEEDS) triggerGameOver(room);
}

function triggerGameOver(room) {
    room.isGameOver = true;
    room.status = 'gameOver';
    room.turnPhase = 'gameOver';
    room.auction = null;

    const scoreboard = getSortedScoreboard(room);
    const summary = scoreboard
        .map((entry, index) => `<div><strong>#${index + 1} ${entry.name}</strong> - ${entry.score} Legacy</div>`)
        .join('');

    logMsg(room, 'The Barakah Bowl is full. The Era of Prosperity has arrived!', 'var(--gold)');
    setInteraction(room, 'Game Over', `<div>${summary}</div>`, [], null, { kind: 'gameOver' });
}

function getOwner(room, boardEntry) {
    return room.players.find((p) => p.id === boardEntry.ownerId) || null;
}

function getColorGroup(color) {
    return BOARD_SPACES.filter((space) => space.color === color).map((space) => space.id);
}

function ownsFullSet(room, ownerId, color) {
    if (!color) return false;
    return getColorGroup(color).every((spaceId) => room.board[spaceId].ownerId === ownerId);
}

function calculateRent(room, player, index) {
    const boardEntry = room.board[index];
    const space = BOARD_SPACES[index];
    const owner = getOwner(room, boardEntry);
    if (!owner) return 0;

    if (space.type === 'station') {
        const count = room.board.filter((entry, i) => BOARD_SPACES[i].type === 'station' && entry.ownerId === owner.id).length;
        return 25 * Math.max(count, 1);
    }

    if (space.type === 'utility') {
        const utilityCount = room.board.filter((entry, i) => BOARD_SPACES[i].type === 'utility' && entry.ownerId === owner.id).length;
        const rollTotal = room.lastRoll ? room.lastRoll.d1 + room.lastRoll.d2 : 7;
        return rollTotal * (utilityCount > 1 ? 10 : 4);
    }

    let rent = space.baseRent || 0;
    if (space.type === 'district' && ownsFullSet(room, owner.id, space.color)) {
        rent *= 2;
    }
    rent += boardEntry.houses * (space.baseRent || 0);

    if (boardEntry.isEndowment) {
        rent += Math.ceil((space.baseRent || 0) * 2);
    }

    return rent;
}

function getBuildableProperties(room, player) {
    return room.board
        .map((entry, index) => ({ entry, index, space: BOARD_SPACES[index] }))
        .filter(({ entry, space }) => (
            entry.ownerId === player.id &&
            space.type === 'district' &&
            ownsFullSet(room, player.id, space.color) &&
            entry.houses < 3 &&
            !entry.isEndowment &&
            player.dirhams >= HOUSE_COST
        ));
}

function getEndowmentProperties(room, player) {
    return room.board
        .map((entry, index) => ({ entry, index, space: BOARD_SPACES[index] }))
        .filter(({ entry, space }) => (
            entry.ownerId === player.id &&
            space.type === 'district' &&
            ownsFullSet(room, player.id, space.color) &&
            entry.houses >= 2 &&
            !entry.isEndowment &&
            player.dirhams >= ENDOWMENT_COST
        ));
}

function startAuction(room, triggeringPlayer, spaceIndex) {
    const space = BOARD_SPACES[spaceIndex];
    const bidders = [];

    for (let offset = 1; offset <= room.players.length; offset++) {
        const player = room.players[(room.turnIndex + offset) % room.players.length];
        if (player.dirhams >= Math.ceil(space.price * MIN_AUCTION_PRICE_FACTOR)) {
            bidders.push(player.id);
        }
    }

    if (bidders.length === 0) {
        logMsg(room, `No one can afford the auction for ${space.name}.`, 'var(--text-muted)');
        room.auction = null;
        return false;
    }

    room.auction = {
        spaceIndex,
        price: Math.ceil(space.price * 0.9),
        minPrice: Math.ceil(space.price * MIN_AUCTION_PRICE_FACTOR),
        bidderQueue: bidders,
        bidderCursor: 0,
        triggeringPlayerId: triggeringPlayer.id
    };

    return true;
}

function offerAuctionTurn(room) {
    if (!room.auction) return false;
    const auction = room.auction;
    const space = BOARD_SPACES[auction.spaceIndex];

    while (auction.bidderCursor < auction.bidderQueue.length) {
        const bidder = room.players.find((player) => player.id === auction.bidderQueue[auction.bidderCursor]);
        if (!bidder || bidder.dirhams < auction.price) {
            auction.bidderCursor++;
            continue;
        }

        setInteraction(
            room,
            'Auction',
            `<strong>${space.name}</strong> is available for <strong>D${auction.price}</strong>.<br>${bidder.name}, do you want to claim it?`,
            [
                { label: 'Buy It', actionId: 'auctionBuy', actionPayload: auction.spaceIndex, primary: true },
                { label: 'Pass', actionId: 'auctionPass', actionPayload: auction.spaceIndex, primary: false }
            ],
            bidder.id,
            { kind: 'auction', spaceIndex: auction.spaceIndex, price: auction.price }
        );
        return true;
    }

    if (auction.price > auction.minPrice) {
        auction.price = Math.max(auction.minPrice, auction.price - Math.ceil(space.price * 0.1));
        auction.bidderCursor = 0;
        return offerAuctionTurn(room);
    }

    logMsg(room, `The auction for ${space.name} ends without a buyer.`, 'var(--text-muted)');
    room.auction = null;
    return false;
}

function queueBotAuctionDecision(io, room) {
    if (!room.interaction || room.interaction.kind !== 'auction') return false;
    const bidder = room.players.find((player) => player.id === room.interaction.targetPlayerId);
    if (!bidder || !bidder.isBot) return false;

    setTimeout(() => {
        if (!room.interaction || room.interaction.kind !== 'auction' || room.interaction.targetPlayerId !== bidder.id) return;
        const button = room.interaction.buttons.find((entry) => entry.primary) || room.interaction.buttons[0];
        if (button) {
            handleAction(io, room, bidder, button.actionId, button.actionPayload);
        }
    }, 700);

    return true;
}

function advanceAuctionOrContinue(io, room, fallbackPlayer) {
    if (!offerAuctionTurn(room)) {
        offerManagement(room, fallbackPlayer);
        broadcast(io, room.code);
        return;
    }

    broadcast(io, room.code);
    queueBotAuctionDecision(io, room);
}

function broadcast(io, roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    const safeState = JSON.parse(JSON.stringify(room));
    safeState.scoreboard = getSortedScoreboard(room);

    io.to(roomCode).emit('gameStateUpdate', safeState);
    handleBotTurn(io, room);
}

function handleBotTurn(io, room) {
    if (room.status !== 'playing' || room.isGameOver) return;
    const activePlayer = getActivePlayer(room);
    const interactionBot = room.interaction && room.interaction.targetPlayerId !== null
        ? room.players.find((player) => player.id === room.interaction.targetPlayerId && player.isBot)
        : null;

    const actingBot = interactionBot || activePlayer;
    if (!actingBot || !actingBot.isBot) return;

    setTimeout(() => {
        if (room.interaction) {
            let chosenButton = room.interaction.buttons.find((button) => button.primary) || room.interaction.buttons[0];

            if (room.interaction.kind === 'manage') {
                const buildButton = room.interaction.buttons.find((button) => button.actionId === 'buildHouse');
                const endowmentButton = room.interaction.buttons.find((button) => button.actionId === 'createEndowment');
                chosenButton = endowmentButton || buildButton || chosenButton;
            }

            if (chosenButton) {
                handleAction(io, room, actingBot, chosenButton.actionId, chosenButton.actionPayload);
            }
            return;
        }

        if (room.turnPhase === 'roll') {
            rollDice(io, room, actingBot);
        } else if (room.turnPhase === 'manage') {
            offerManagement(room, actingBot);
            broadcast(io, room.code);
        } else {
            endTurn(io, room);
        }
    }, 900);
}

function movePlayer(room, player, spaces) {
    const previousPosition = player.position;
    const nextPos = (player.position + spaces) % 40;
    if (nextPos < previousPosition) {
        player.dirhams += 200;
        logMsg(room, `${player.name} passed The Gate and collects D200.`, player.color);
    }
    player.position = nextPos;
}

function sendToReflection(room, player, reasonText) {
    player.position = 10;
    player.inReflection = true;
    player.reflectionTurns = 0;
    room.turnPhase = 'resolve';
    logMsg(room, `${player.name} was sent to the Reflection Garden${reasonText ? ` ${reasonText}` : ''}.`, player.color);
}

function advanceToNextPlayer(room) {
    if (room.players.length === 0) return;

    let attempts = 0;
    do {
        room.turnIndex = (room.turnIndex + 1) % room.players.length;
        attempts++;
        const player = getActivePlayer(room);
        if (player.skippedTurns > 0) {
            player.skippedTurns--;
            logMsg(room, `${player.name} skips this turn.`, player.color);
        } else {
            break;
        }
    } while (attempts <= room.players.length);
}

function beginTurn(room) {
    clearInteraction(room);
    room.auction = null;
    room.turnPhase = 'roll';
    room.doublesCount = 0;
    room.lastRoll = null;
    const activePlayer = getActivePlayer(room);
    if (activePlayer) {
        logMsg(room, `--- ${activePlayer.name}'s Turn ---`, activePlayer.color);
    }
}

function finishTurn(io, room) {
    advanceToNextPlayer(room);
    beginTurn(room);
    broadcast(io, room.code);
}

function endTurn(io, room) {
    if (room.isGameOver) {
        broadcast(io, room.code);
        return;
    }

    const activePlayer = getActivePlayer(room);
    if (room.lastRoll && room.lastRoll.isDoubles && activePlayer && !activePlayer.inReflection) {
        clearInteraction(room);
        room.turnPhase = 'roll';
        logMsg(room, `${activePlayer.name} rolled doubles and may roll again.`, activePlayer.color);
        broadcast(io, room.code);
        return;
    }

    finishTurn(io, room);
}

function applyTidesCard(room, player, card) {
    switch (card.id) {
        case 'tof_1': {
            const bonus = room.barakahBowl * 10;
            room.players.forEach((p) => {
                p.dirhams += 50 + bonus;
            });
            logMsg(room, `Bountiful Harvest: everyone receives D${50 + bonus}.`, 'var(--gold)');
            break;
        }
        case 'tof_4':
            addSeed(room, room.players.length);
            logMsg(room, 'Unexpected Rain blesses the whole table.', 'var(--emerald)');
            break;
        case 'tof_6': {
            const reduction = Math.floor(room.barakahBowl / 2) * 10;
            const payment = Math.max(0, 50 - reduction);
            room.players.forEach((p) => {
                p.dirhams -= payment;
            });
            logMsg(room, `Economic Downturn: each player pays D${payment}.`, '#d68b54');
            break;
        }
        case 'tof_7': {
            const buildable = getBuildableProperties(room, player);
            if (buildable.length > 0) {
                const target = buildable[0];
                target.entry.houses += 1;
                logMsg(room, `${player.name} gains a free Shelter on ${target.space.name}.`, player.color);
            }
            break;
        }
        case 'tof_8':
            player.position = 0;
            player.dirhams += 200;
            logMsg(room, `${player.name} returns to The Gate and collects D200.`, player.color);
            break;
        case 'tof_10': {
            const released = room.players.filter((p) => p.inReflection);
            released.forEach((p) => {
                p.inReflection = false;
                p.reflectionTurns = 0;
                addSeed(room);
            });
            if (released.length > 0) {
                logMsg(room, 'The Healing Springs releases everyone from Reflection.', 'var(--emerald)');
            }
            break;
        }
        case 'tof_12':
            room.players.forEach((p) => {
                if (p.id !== player.id) p.skippedTurns += 1;
            });
            logMsg(room, 'Dust Storm forces the rest of the table to shelter next turn.', '#c97f8c');
            break;
        case 'tof_15': {
            const poorest = [...room.players].sort((a, b) => a.dirhams - b.dirhams)[0];
            if (room.commonWell > 0) {
                poorest.dirhams += room.commonWell;
                logMsg(room, `${poorest.name} receives D${room.commonWell} from the Common Well.`, poorest.color);
                room.commonWell = 0;
            } else {
                poorest.dirhams += 300;
                logMsg(room, `${poorest.name} receives D300 from the bank.`, poorest.color);
            }
            break;
        }
        case 'tof_16':
            if (room.barakahBowl >= 15) {
                triggerGameOver(room);
            }
            break;
        default:
            logMsg(room, `[Fate Enacted] ${card.name} changes the mood of the era.`, 'var(--text-muted)');
            break;
    }
}

function offerManagement(room, player) {
    const buttons = [];
    const buildable = getBuildableProperties(room, player);
    const endowable = getEndowmentProperties(room, player);

    buildable.slice(0, 3).forEach(({ index, space, entry }) => {
        buttons.push({
            label: `Build ${space.name}${entry.houses > 0 ? ` (${entry.houses}/3)` : ''}`,
            actionId: 'buildHouse',
            actionPayload: index,
            primary: false
        });
    });

    endowable.slice(0, 2).forEach(({ index, space }) => {
        buttons.push({
            label: `Endow ${space.name}`,
            actionId: 'createEndowment',
            actionPayload: index,
            primary: false
        });
    });

    buttons.push({
        label: room.lastRoll && room.lastRoll.isDoubles ? 'Roll Again' : 'Finish Turn',
        actionId: 'finishManagement',
        primary: buttons.length === 0
    });

    const descBits = [];
    if (buildable.length > 0) descBits.push(`Build a Shelter for D${HOUSE_COST}.`);
    if (endowable.length > 0) descBits.push(`Create an Endowment for D${ENDOWMENT_COST} after 2+ shelters.`);
    if (descBits.length === 0) descBits.push('No upgrades are available right now.');

    room.turnPhase = 'manage';
    setInteraction(
        room,
        'Stewardship Phase',
        descBits.join(' '),
        buttons,
        player.id,
        { kind: 'manage' }
    );
}

function continueAfterResolution(io, room, player) {
    if (room.isGameOver) {
        broadcast(io, room.code);
        return;
    }

    if (room.auction) {
        advanceAuctionOrContinue(io, room, player);
        return;
    }

    offerManagement(room, player);
    broadcast(io, room.code);
}

function resolveSpace(io, room, player, index) {
    const space = BOARD_SPACES[index];
    const boardEntry = room.board[index];
    room.turnPhase = 'resolve';

    if (space.type === 'tides') {
        if (room.tofDeck.length === 0) {
            room.tofDeck = shuffle([...room.tofDiscard]);
            room.tofDiscard = [];
        }

        if (room.tofDeck.length > 0) {
            const card = room.tofDeck.pop();
            room.tofDiscard.push(card);
            logMsg(room, `<strong style="color:${player.color}">${player.name}</strong> drew <strong>${card.name}</strong>.`, player.color);
            applyTidesCard(room, player, card);
            setInteraction(room, card.name, card.desc, [{ label: 'Continue', actionId: 'endTurn', primary: true }], player.id, { kind: 'card' });
        } else {
            continueAfterResolution(io, room, player);
        }
        broadcast(io, room.code);
        return;
    }

    if (space.type === 'charity') {
        setInteraction(room, 'Charity', space.desc, [{ label: 'Pay', actionId: 'payWell', actionPayload: space.amount, primary: true }], player.id, { kind: 'charity' });
        broadcast(io, room.code);
        return;
    }

    if (space.type === 'oasis') {
        if (room.commonWell >= 100) {
            const poorest = [...room.players].sort((a, b) => a.dirhams - b.dirhams)[0];
            poorest.dirhams += 100;
            room.commonWell -= 100;
            logMsg(room, `${poorest.name} drinks from the Common Well and receives D100.`, poorest.color);
        } else {
            logMsg(room, `${player.name} found calm at The Oasis.`, player.color);
        }
        continueAfterResolution(io, room, player);
        return;
    }

    if (space.type === 'go_to_reflection') {
        sendToReflection(room, player);
        endTurn(io, room);
        return;
    }

    if (space.type === 'district' || space.type === 'station' || space.type === 'utility') {
        if (boardEntry.ownerId === null) {
            if (player.dirhams >= space.price) {
                setInteraction(
                    room,
                    'Unowned Property',
                    `Invest in <strong>${space.name}</strong> for <strong>D${space.price}</strong> or send it to auction.`,
                    [
                        { label: 'Invest', actionId: 'buyProperty', actionPayload: index, primary: true },
                        { label: 'Auction', actionId: 'auctionProperty', actionPayload: index, primary: false }
                    ],
                    player.id,
                    { kind: 'propertyOffer', spaceIndex: index }
                );
            } else {
                setInteraction(
                    room,
                    'Cannot Afford',
                    `${space.name} is out of reach, but the table can still auction it.`,
                    [{ label: 'Start Auction', actionId: 'auctionProperty', actionPayload: index, primary: true }],
                    player.id,
                    { kind: 'propertyOffer', spaceIndex: index }
                );
            }
            broadcast(io, room.code);
            return;
        }

        if (boardEntry.ownerId !== player.id) {
            const owner = getOwner(room, boardEntry);
            const rent = calculateRent(room, player, index);
            setInteraction(
                room,
                'Contribution Due',
                `<strong>${player.name}</strong> landed on <strong>${space.name}</strong>. Contribution due: <strong>D${rent}</strong>.`,
                [
                    { label: 'Pay Rent', actionId: 'payRent', actionPayload: rent, primary: true },
                    { label: 'Waive Rent', actionId: 'waiveRent', actionPayload: rent, primary: false }
                ],
                owner ? owner.id : player.id,
                { kind: 'rent', spaceIndex: index, visitorId: player.id }
            );
            broadcast(io, room.code);
            return;
        }
    }

    continueAfterResolution(io, room, player);
}

function rollDice(io, room, player) {
    const activePlayer = getActivePlayer(room);
    if (room.interaction || room.isGameOver || !activePlayer || player.id !== activePlayer.id || room.turnPhase !== 'roll') return;

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const isDoubles = d1 === d2;

    room.lastRoll = { d1, d2, isDoubles };
    logMsg(room, `<strong style="color:${player.color}">${player.name}</strong> rolled ${d1} and ${d2}.`, player.color);

    if (player.inReflection) {
        if (isDoubles) {
            player.inReflection = false;
            player.reflectionTurns = 0;
            logMsg(room, `${player.name} leaves the Reflection Garden by rolling doubles.`, player.color);
        } else {
            player.reflectionTurns += 1;
            if (player.reflectionTurns >= 3) {
                player.inReflection = false;
                player.reflectionTurns = 0;
                logMsg(room, `${player.name} has reflected long enough and may leave.`, player.color);
            } else {
                logMsg(room, `${player.name} remains in Reflection for ${3 - player.reflectionTurns} more turn(s).`, player.color);
                room.turnPhase = 'resolve';
                endTurn(io, room);
                return;
            }
        }
    } else if (isDoubles) {
        room.doublesCount += 1;
        if (room.doublesCount >= 3) {
            addSeed(room);
            sendToReflection(room, player, 'after three doubles');
            room.lastRoll = { d1, d2, isDoubles: false };
            endTurn(io, room);
            return;
        }
    } else {
        room.doublesCount = 0;
    }

    movePlayer(room, player, d1 + d2);
    resolveSpace(io, room, player, player.position);
}

function handleAction(io, room, actor, actionId, payload) {
    if (room.isGameOver) return;

    const activePlayer = getActivePlayer(room);
    const currentSpace = activePlayer ? BOARD_SPACES[activePlayer.position] : null;
    const currentBoardEntry = activePlayer ? room.board[activePlayer.position] : null;

    if (actionId === 'endTurn') {
        endTurn(io, room);
        return;
    }

    if (!room.interaction) return;

    if (room.interaction.targetPlayerId !== null && room.interaction.targetPlayerId !== actor.id) {
        return;
    }

    if (actionId === 'payWell') {
        actor.dirhams -= payload;
        room.commonWell += payload;
        logMsg(room, `${actor.name} contributes D${payload} to the Common Well.`, actor.color);
        continueAfterResolution(io, room, activePlayer);
        return;
    }

    if (actionId === 'buyProperty' && activePlayer && currentSpace && currentBoardEntry) {
        activePlayer.dirhams -= currentSpace.price;
        currentBoardEntry.ownerId = activePlayer.id;
        logMsg(room, `${activePlayer.name} invests in ${currentSpace.name}.`, activePlayer.color);
        continueAfterResolution(io, room, activePlayer);
        return;
    }

    if (actionId === 'auctionProperty') {
        const auctionSpaceIndex = typeof payload === 'number' ? payload : activePlayer.position;
        clearInteraction(room);
        if (startAuction(room, activePlayer, auctionSpaceIndex)) {
            logMsg(room, `${activePlayer.name} sends ${BOARD_SPACES[auctionSpaceIndex].name} to auction.`, activePlayer.color);
            advanceAuctionOrContinue(io, room, activePlayer);
        } else {
            continueAfterResolution(io, room, activePlayer);
        }
        return;
    }

    if (actionId === 'auctionBuy' && room.auction) {
        const { spaceIndex, price } = room.auction;
        const boardEntry = room.board[spaceIndex];
        const space = BOARD_SPACES[spaceIndex];
        actor.dirhams -= price;
        boardEntry.ownerId = actor.id;
        room.auction = null;
        clearInteraction(room);
        logMsg(room, `${actor.name} wins the auction for ${space.name} at D${price}.`, actor.color);
        continueAfterResolution(io, room, activePlayer);
        return;
    }

    if (actionId === 'auctionPass' && room.auction) {
        room.auction.bidderCursor += 1;
        clearInteraction(room);
        advanceAuctionOrContinue(io, room, activePlayer);
        return;
    }

    if (actionId === 'payRent' && activePlayer && currentBoardEntry) {
        const owner = getOwner(room, currentBoardEntry);
        const rent = typeof payload === 'number' ? payload : calculateRent(room, activePlayer, activePlayer.position);
        if (owner) {
            activePlayer.dirhams -= rent;
            if (currentBoardEntry.isEndowment) {
                room.commonWell += rent;
                logMsg(room, `${activePlayer.name} pays D${rent} into the Common Well for ${currentSpace.name}.`, '#8bc5a5');
            } else {
                owner.dirhams += rent;
                logMsg(room, `${activePlayer.name} pays D${rent} to ${owner.name}.`, owner.color);
            }
        }
        continueAfterResolution(io, room, activePlayer);
        return;
    }

    if (actionId === 'waiveRent' && activePlayer && currentBoardEntry) {
        const owner = getOwner(room, currentBoardEntry);
        if (owner) {
            owner.gratitudeTokens += 1;
            addSeed(room);
            logMsg(room, `${owner.name} waives the contribution for ${activePlayer.name} and gains a Gratitude Token.`, owner.color);
        }
        continueAfterResolution(io, room, activePlayer);
        return;
    }

    if (actionId === 'buildHouse' && activePlayer && actor.id === activePlayer.id) {
        const entry = room.board[payload];
        const space = BOARD_SPACES[payload];
        if (entry && space && entry.ownerId === actor.id && actor.dirhams >= HOUSE_COST && entry.houses < 3 && ownsFullSet(room, actor.id, space.color) && !entry.isEndowment) {
            actor.dirhams -= HOUSE_COST;
            entry.houses += 1;
            logMsg(room, `${actor.name} builds a Shelter on ${space.name}.`, actor.color);
        }
        offerManagement(room, activePlayer);
        broadcast(io, room.code);
        return;
    }

    if (actionId === 'createEndowment' && activePlayer && actor.id === activePlayer.id) {
        const entry = room.board[payload];
        const space = BOARD_SPACES[payload];
        if (entry && space && entry.ownerId === actor.id && actor.dirhams >= ENDOWMENT_COST && entry.houses >= 2 && !entry.isEndowment && ownsFullSet(room, actor.id, space.color)) {
            actor.dirhams -= ENDOWMENT_COST;
            entry.isEndowment = true;
            addSeed(room);
            logMsg(room, `${actor.name} turns ${space.name} into a Legacy Endowment. Rent now feeds the Common Well.`, actor.color);
        }
        offerManagement(room, activePlayer);
        broadcast(io, room.code);
        return;
    }

    if (actionId === 'finishManagement') {
        clearInteraction(room);
        endTurn(io, room);
    }
}

module.exports = {
    handleConnection(io, socket) {
        socket.on('joinRoom', ({ name, color, roomCode }) => {
            const normalizedRoomCode = roomCode ? String(roomCode).toUpperCase() : Math.random().toString(36).substring(2, 6).toUpperCase();
            const room = initRoom(normalizedRoomCode);

            if (room.status !== 'lobby' || room.players.length >= MAX_PLAYERS) return;

            socket.join(normalizedRoomCode);

            const player = createPlayer(name, color, socket.id, false);
            drawNiyyahCards(room, player, 3);

            if (room.players.length === 0) room.host = socket.id;
            room.players.push(player);
            broadcast(io, normalizedRoomCode);
        });

        socket.on('addBot', () => {
            const room = getRoom(socket);
            if (!room || room.host !== socket.id || room.status !== 'lobby' || room.players.length >= MAX_PLAYERS) return;

            const bot = createPlayer(null, '#8f96a3', null, true);
            drawNiyyahCards(room, bot, 3);
            room.players.push(bot);
            broadcast(io, room.code);
        });

        socket.on('startGame', () => {
            const room = getRoom(socket);
            if (!room || room.host !== socket.id || room.players.length < 2) return;

            room.status = 'playing';
            beginTurn(room);
            logMsg(room, 'The Stewardship begins.', 'var(--emerald)');
            broadcast(io, room.code);
        });

        socket.on('rollDice', () => {
            const room = getRoom(socket);
            const player = room ? findPlayerBySocket(room, socket.id) : null;
            if (room && player) {
                rollDice(io, room, player);
            }
        });

        socket.on('submitAction', ({ actionId, payload }) => {
            const room = getRoom(socket);
            const player = room ? findPlayerBySocket(room, socket.id) : null;
            if (room && player) {
                handleAction(io, room, player, actionId, payload);
            }
        });
    },

    handleDisconnect(io, socket) {
        const room = getRoom(socket);
        if (!room) return;

        const idx = room.players.findIndex((p) => p.socketId === socket.id);
        if (idx !== -1) {
            room.players.splice(idx, 1);
        }

        if (room.players.length === 0) {
            delete rooms[room.code];
            return;
        }

        if (room.turnIndex >= room.players.length) {
            room.turnIndex = 0;
        }

        if (room.host === socket.id) {
            const nextHost = room.players.find((p) => !p.isBot) || room.players[0];
            room.host = nextHost.socketId;
        }

        if (room.status === 'playing') {
            beginTurn(room);
        }

        broadcast(io, room.code);
    }
};
