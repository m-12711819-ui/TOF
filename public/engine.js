// public/engine.js
const socket = io();

let state = null;
let mySocketId = null;
let printedMessageIds = new Set(); // to prevent duplicate fade-out logs

const dom = {
    board: document.getElementById('board'),
    btnRoll: document.getElementById('btn-roll'),
    btnEnd: document.getElementById('btn-end-turn'),
    commonWell: document.getElementById('common-well-amount'),
    seedsCount: document.getElementById('seeds-count'),
    die1: document.getElementById('die1'),
    die2: document.getElementById('die2'),
    log: document.getElementById('game-log'),
    playersDashboard: document.getElementById('players-dashboard'),
    interaction: document.getElementById('interaction-panel'),
    intTitle: document.getElementById('interaction-title'),
    intDesc: document.getElementById('interaction-desc'),
    intButtons: document.getElementById('interaction-buttons'),
    cardDisplay: document.getElementById('card-display'),
    cardTitle: document.getElementById('card-title'),
    cardDesc: document.getElementById('card-desc'),
    btnDismissCard: document.getElementById('btn-dismiss-card'),
    
    // Lobby
    lobbyScreen: document.getElementById('lobby-screen'),
    waitingRoom: document.getElementById('waiting-room'),
    gameScreen: document.getElementById('game-screen'),
    btnJoin: document.getElementById('btn-join-room'),
    btnAddBot: document.getElementById('btn-add-bot'),
    btnStart: document.getElementById('btn-start-game'),
    dispRoomCode: document.getElementById('display-room-code'),
    lobbyPlayersList: document.getElementById('lobby-players-list')
};

// Initialize static board
function getGridPos(index) {
    if(index >= 0 && index <= 10) return { r: 11, c: 11 - index };
    if(index > 10 && index <= 20) return { r: 21 - index, c: 1 };
    if(index > 20 && index <= 30) return { r: 1, c: index - 19 };
    if(index > 30 && index <= 39) return { r: index - 29, c: 11 };
    return { r: 11, c: 11 };
}

function getSpaceStyleClass(index) {
    if(index === 0 || index === 10 || index === 20 || index === 30) return 'corner';
    if(index > 0 && index < 10) return 'bottom';
    if(index > 10 && index < 20) return 'left';
    if(index > 20 && index < 30) return 'top';
    if(index > 30 && index < 40) return 'right';
}

function createBoardUI() {
    BOARD_SPACES.forEach((space, i) => {
        let div = document.createElement('div');
        div.className = 'space ' + getSpaceStyleClass(i);
        div.id = 'space-' + i;
        const pos = getGridPos(i);
        div.style.gridRow = pos.r;
        div.style.gridColumn = pos.c;

        if(space.color && COLOR_MAP[space.color]) {
            let cb = document.createElement('div');
            cb.className = 'color-bar';
            cb.style.backgroundColor = COLOR_MAP[space.color];
            div.appendChild(cb);
        }

        let contentDiv = document.createElement('div');
        contentDiv.className = 'space-content';
        
        let nameDiv = document.createElement('div');
        nameDiv.className = 'name';
        nameDiv.innerHTML = space.name.replace(/^[Tt]he\s/i, '');
        contentDiv.appendChild(nameDiv);

        if(space.price) {
            let pDiv = document.createElement('div');
            pDiv.className = 'price';
            pDiv.innerText = 'D' + space.price;
            contentDiv.appendChild(pDiv);
        }

        div.appendChild(contentDiv);

        let tokensContainer = document.createElement('div');
        tokensContainer.className = 'tokens-container';
        tokensContainer.id = 'space-tokens-' + i;
        div.appendChild(tokensContainer);

        dom.board.appendChild(div);
    });
}
createBoardUI();

// Socket event bindings
socket.on('connect', () => { mySocketId = socket.id; });

dom.btnJoin.addEventListener('click', () => {
    let name = document.getElementById('player-name').value;
    let color = document.getElementById('player-color').value;
    let code = document.getElementById('room-code-input').value;
    socket.emit('joinRoom', { name, color, roomCode: code });
    
    dom.lobbyScreen.classList.add('hidden');
    dom.waitingRoom.classList.remove('hidden');
});

dom.btnAddBot.addEventListener('click', () => {
    socket.emit('addBot');
});

dom.btnStart.addEventListener('click', () => {
    socket.emit('startGame');
});

dom.btnRoll.addEventListener('click', () => {
    // Visual fake roll
    dom.die1.classList.add('rolling'); dom.die2.classList.add('rolling');
    setTimeout(() => {
        dom.die1.classList.remove('rolling'); dom.die2.classList.remove('rolling');
        socket.emit('rollDice');
    }, 500);
});

// Remove unused dismiss button local listener, rely on server interactions.

// Niyyah toggle remains UI only
window.toggleNiyyah = function(playerId) {
    let p = state.players.find(x => x.id === playerId);
    if (p) {
        p.showNiyyahUI = !p.showNiyyahUI;
        renderDashboard();
    }
}

function renderDashboard() {
    dom.playersDashboard.innerHTML = '';
    state.players.forEach(p => {
        let pCard = document.createElement('div');
        pCard.className = 'player-card glass-panel ' + (p.id === state.turnIndex ? 'active-turn' : '');
        pCard.style.borderLeftColor = p.color;
        
        let niyyahHtml = '';
        // Only show button if it's MY player (or if we allow viewers to see it, but physically they shouldn't see opponents' cards)
        let isMe = p.socketId === mySocketId && !p.isBot;
        
        if (p.showNiyyahUI && (isMe || p.isBot)) { // For testing, let viewers see bot cards if they click
            niyyahHtml = `
                <div class="niyyah-list" style="margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 4px; font-size: 0.85rem; border: 1px solid var(--emerald);">
                    <h4 style="margin-bottom: 8px; color: var(--emerald);">Niyyah Cards</h4>
                    ${p.niyyahCards.map(c => `<div style="margin-bottom:8px;"><strong>${c.name}</strong><br><span style="font-size:0.8rem;color:var(--text-muted)">${c.desc} (+<span style="color:var(--gold)">${c.bonus}D</span>)</span></div>`).join('')}
                </div>
            `;
        }

        let niyyahBtn = '';
        if (isMe || p.isBot) {
            niyyahBtn = `<button class="secondary-btn" style="width: 100%; margin-top: 10px; padding: 6px; font-size: 0.8rem;" onclick="toggleNiyyah(${p.id})">
                ${p.showNiyyahUI ? 'Hide Niyyah Cards' : 'View Niyyah Cards'}
            </button>`;
        }

        pCard.innerHTML = `
            <div class="player-header">
                <strong>${p.name} ${isMe ? '(You)' : ''} ${p.isBot ? '🤖' : ''}</strong> 
                <span style="color:var(--gold)">D${p.dirhams}</span>
            </div>
            <div class="player-stats">
                <div class="stat-item">Districts: <span>${state.board.filter(b=>b.ownerId===p.id || b.coOwnerId===p.id).length}</span></div>
                <div class="stat-item">Gratitude: <span>${p.gratitudeTokens}</span></div>
            </div>
            ${niyyahBtn}
            ${niyyahHtml}
        `;
        dom.playersDashboard.appendChild(pCard);

        // Position their token on the board map
        let existing = document.getElementById('token-' + p.id);
        if(existing) existing.remove();

        let spaceTokens = document.getElementById('space-tokens-' + p.position);
        if(spaceTokens) {
            let t = document.createElement('div');
            t.className = 'token';
            t.id = 'token-' + p.id;
            t.style.backgroundColor = p.color;
            spaceTokens.appendChild(t);
        }
    });
}

function logMsgToDOM(msg, colorStr) {
    let li = document.createElement('li');
    li.innerHTML = msg;
    if (colorStr) { li.style.borderLeft = `3px solid ${colorStr}`; li.style.paddingLeft = '6px'; }
    li.classList.add('fade-out-log');
    dom.log.prepend(li);
    
    setTimeout(() => {
        li.style.transition = 'all 0.5s ease-out';
        li.style.minHeight = '0px'; li.style.height = '0px'; li.style.margin = '0px';
        li.style.paddingTop = '0px'; li.style.paddingBottom = '0px'; li.style.opacity = '0'; li.style.border = 'none';
        setTimeout(() => { if (li.parentNode) li.parentNode.removeChild(li); }, 500);
    }, 10000);
}

socket.on('gameStateUpdate', (newState) => {
    // Merge new state while preserving local UI toggles
    if (state && state.players) {
        newState.players.forEach(np => {
            let oldP = state.players.find(op => op.id === np.id);
            if (oldP) np.showNiyyahUI = oldP.showNiyyahUI;
        });
    }
    state = newState;

    if (state.status === 'lobby') {
        dom.dispRoomCode.innerText = state.code;
        dom.lobbyPlayersList.innerHTML = state.players.map(p => `<li>${p.name} <span style="display:inline-block;width:10px;height:10px;background:${p.color};border-radius:50%"></span> ${p.socketId === mySocketId ? '(You)' : ''}</li>`).join('');
        
        // Show start button only if host and >=2 players total (or bots)
        if (state.host === mySocketId && state.players.length >= 2) {
            dom.btnStart.style.display = 'block';
        } else {
            dom.btnStart.style.display = 'none';
        }

    } else if (state.status === 'playing' || state.status === 'gameOver') {
        dom.lobbyScreen.classList.add('hidden');
        dom.waitingRoom.classList.add('hidden');
        dom.gameScreen.classList.remove('hidden');

        dom.commonWell.innerText = state.commonWell;
        dom.seedsCount.innerText = state.barakahBowl;

        renderDashboard();

        // Print new messages
        state.messages.forEach(m => {
            if (!printedMessageIds.has(m.id)) {
                logMsgToDOM(m.msg, m.colorStr);
                printedMessageIds.add(m.id);
            }
        });

        let activePlayer = state.players[state.turnIndex];
        let isMyTurn = activePlayer && (activePlayer.socketId === mySocketId);

        if (state.interaction) {
            dom.btnRoll.classList.add('hidden');
            dom.btnEnd.classList.add('hidden');
            dom.interaction.classList.remove('hidden');
            dom.intTitle.innerText = state.interaction.title;
            dom.intDesc.innerHTML = state.interaction.desc;
            dom.intButtons.innerHTML = '';
            
            // Only show interaction buttons to the active player whose turn it is
            if (isMyTurn) {
                state.interaction.buttons.forEach(b => {
                    let btn = document.createElement('button');
                    btn.innerText = b.label;
                    btn.className = b.primary ? 'primary-btn' : 'secondary-btn';
                    btn.onclick = () => { socket.emit('submitAction', { actionId: b.actionId, payload: b.actionPayload }); };
                    dom.intButtons.appendChild(btn);
                });
            } else {
                dom.intButtons.innerHTML = `<p style="font-size:0.8rem; color:var(--text-muted)">Waiting for ${activePlayer.name}...</p>`;
            }
        } else {
            dom.interaction.classList.add('hidden');
            
            if (isMyTurn && !state.isGameOver) {
                if (state.doublesCount > 0 && !activePlayer.inReflection) {
                    dom.btnRoll.classList.remove('hidden');
                    dom.btnEnd.classList.add('hidden');
                } else {
                    // Turn started, needs to roll
                    // Note: backend expects rollDice if doublesCount == 0
                    // Actually, if it's start of turn, they should roll. If they just rolled (doublesCount updated), logic might be tricky.
                    // For simplicity, if btnRoll hasn't been blocked, let them roll.
                    // Wait, in local, End Turn appears instead of Roll if they already moved.
                    // If no interaction, and not doubles, they need to end turn?
                    // Let's refine based on "canRoll" state. We lack that from server.
                    // In gameLogic, resolving a space either causes an interaction, or falls back to endTurn(). Wait! 
                    // My gameLogic currently calls `endTurn(io, room)` automatically if there's no interaction! 
                    // So if there's no interaction, it's ALREADY the next player's roll phase!
                    dom.btnRoll.classList.remove('hidden');
                    dom.btnEnd.classList.add('hidden'); // We don't even need 'End Turn' button anymore since server auto-ends when nothing to do!
                }
            } else {
                dom.btnRoll.classList.add('hidden');
                dom.btnEnd.classList.add('hidden');
            }
        }
    }
});
