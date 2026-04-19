const socket = io();

let state = null;
let printedMessageIds = new Set();

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
    lobbyScreen: document.getElementById('lobby-screen'),
    waitingRoom: document.getElementById('waiting-room'),
    gameScreen: document.getElementById('game-screen'),
    btnJoin: document.getElementById('btn-join-room'),
    btnAddBot: document.getElementById('btn-add-bot'),
    btnStart: document.getElementById('btn-start-game'),
    dispRoomCode: document.getElementById('display-room-code'),
    lobbyPlayersList: document.getElementById('lobby-players-list'),
    btnShowRules: document.getElementById('btn-show-rules'),
    btnCloseRules: document.getElementById('btn-close-rules'),
    rulesModal: document.getElementById('rules-modal'),
    turnIndicator: document.getElementById('turn-indicator'),
    phaseIndicator: document.getElementById('phase-indicator'),
    lastRollIndicator: document.getElementById('last-roll-indicator'),
    scoreboardList: document.getElementById('scoreboard-list')
};

function getGridPos(index) {
    if (index >= 0 && index <= 10) return { r: 11, c: 11 - index };
    if (index > 10 && index <= 20) return { r: 21 - index, c: 1 };
    if (index > 20 && index <= 30) return { r: 1, c: index - 19 };
    if (index > 30 && index <= 39) return { r: index - 29, c: 11 };
    return { r: 11, c: 11 };
}

function getSpaceStyleClass(index) {
    if (index === 0 || index === 10 || index === 20 || index === 30) return 'corner';
    if (index > 0 && index < 10) return 'bottom';
    if (index > 10 && index < 20) return 'left';
    if (index > 20 && index < 30) return 'top';
    return 'right';
}

function getSpaceBadgeLabel(space) {
    switch (space.type) {
        case 'district':
            return '';
        case 'station':
            return 'Route';
        case 'utility':
            return 'Utility';
        case 'tides':
            return 'Fate';
        case 'charity':
            return 'Charity';
        case 'oasis':
            return 'Oasis';
        case 'gate':
            return 'Gate';
        case 'reflection_visiting':
            return 'Reflection';
        case 'go_to_reflection':
            return 'Go To';
        default:
            return '';
    }
}

function createBoardUI() {
    BOARD_SPACES.forEach((space, i) => {
        const div = document.createElement('div');
        div.className = `space ${getSpaceStyleClass(i)}`;
        div.id = `space-${i}`;

        const pos = getGridPos(i);
        div.style.gridRow = pos.r;
        div.style.gridColumn = pos.c;

        if (space.color && COLOR_MAP[space.color]) {
            const cb = document.createElement('div');
            cb.className = 'color-bar';
            cb.style.backgroundColor = COLOR_MAP[space.color];
            div.appendChild(cb);
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'space-content';

        const badge = document.createElement('div');
        const badgeLabel = getSpaceBadgeLabel(space);
        if (badgeLabel) {
            badge.className = `space-type ${space.type}`;
            badge.textContent = badgeLabel;
            contentDiv.appendChild(badge);
        }

        const nameDiv = document.createElement('div');
        nameDiv.className = 'name';
        nameDiv.textContent = space.name.replace(/^[Tt]he\s/i, '');
        contentDiv.appendChild(nameDiv);

        if (space.price) {
            const pDiv = document.createElement('div');
            pDiv.className = 'price';
            pDiv.innerText = `D${space.price}`;
            contentDiv.appendChild(pDiv);
        }

        const ownerDiv = document.createElement('div');
        ownerDiv.className = 'owner-badge hidden';
        ownerDiv.id = `owner-badge-${i}`;
        contentDiv.appendChild(ownerDiv);

        div.appendChild(contentDiv);

        const tokensContainer = document.createElement('div');
        tokensContainer.className = 'tokens-container';
        tokensContainer.id = `space-tokens-${i}`;
        div.appendChild(tokensContainer);

        dom.board.appendChild(div);
    });
}

createBoardUI();

function getMe() {
    if (!state) return null;
    return state.players.find((player) => player.socketId === socket.id) || null;
}

function updateDiceUI(lastRoll) {
    dom.die1.textContent = lastRoll ? lastRoll.d1 : '?';
    dom.die2.textContent = lastRoll ? lastRoll.d2 : '?';
}

function logMsgToDOM(msg, colorStr) {
    const li = document.createElement('li');
    li.innerHTML = msg;
    if (colorStr) {
        li.style.borderLeft = `3px solid ${colorStr}`;
        li.style.paddingLeft = '8px';
    }
    li.classList.add('fade-out-log');
    dom.log.prepend(li);

    setTimeout(() => {
        li.style.transition = 'all 0.5s ease-out';
        li.style.minHeight = '0px';
        li.style.height = '0px';
        li.style.margin = '0px';
        li.style.paddingTop = '0px';
        li.style.paddingBottom = '0px';
        li.style.opacity = '0';
        li.style.border = 'none';
        setTimeout(() => {
            if (li.parentNode) li.parentNode.removeChild(li);
        }, 500);
    }, 10000);
}

window.toggleNiyyah = function toggleNiyyah(playerId) {
    const player = state.players.find((entry) => entry.id === playerId);
    if (player) {
        player.showNiyyahUI = !player.showNiyyahUI;
        renderDashboard();
    }
};

function renderScoreboard() {
    if (!state || !state.scoreboard) return;
    dom.scoreboardList.innerHTML = state.scoreboard.map((entry, index) => `
        <div class="score-row">
            <div class="score-rank">#${index + 1}</div>
            <div class="score-meta">
                <strong>${entry.name}</strong>
                <span>${entry.gratitudeTokens} gratitude</span>
            </div>
            <div class="score-value">${entry.score}</div>
        </div>
    `).join('');
}

function renderDashboard() {
    dom.playersDashboard.innerHTML = '';

    state.players.forEach((player) => {
        const isTurn = state.players[state.turnIndex] && state.players[state.turnIndex].id === player.id;
        const isMe = player.socketId === socket.id && !player.isBot;
        const holdings = state.board.filter((entry) => entry.ownerId === player.id || entry.coOwnerId === player.id).length;
        const builtShelters = state.board
            .filter((entry) => entry.ownerId === player.id)
            .reduce((sum, entry) => sum + entry.houses, 0);
        const endowments = state.board.filter((entry) => entry.ownerId === player.id && entry.isEndowment).length;

        const niyyahHtml = player.showNiyyahUI && isMe
            ? `
                <div class="niyyah-list">
                    <h4>Niyyah Cards</h4>
                    ${player.niyyahCards.map((card) => `
                        <div class="niyyah-card">
                            <strong>${card.name}</strong>
                            <span>${card.desc}</span>
                            <em>+${card.bonus} Legacy</em>
                        </div>
                    `).join('')}
                </div>
            `
            : '';

        const statusFlags = [];
        if (player.inReflection) statusFlags.push('In Reflection');
        if (player.skippedTurns > 0) statusFlags.push(`Skip ${player.skippedTurns}`);
        if (isTurn) statusFlags.push('Active');

        const card = document.createElement('div');
        card.className = `player-card glass-panel ${isTurn ? 'active-turn' : ''}`;
        card.style.borderLeftColor = player.color;
        card.innerHTML = `
            <div class="player-header">
                <div>
                    <strong>${player.name}${isMe ? ' (You)' : ''}${player.isBot ? ' [Bot]' : ''}</strong>
                    <div class="player-flags">${statusFlags.join(' / ') || 'Ready'}</div>
                </div>
                <span class="money-pill">D${player.dirhams}</span>
            </div>
            <div class="player-stats">
                <div class="stat-item"><span class="stat-label">Holdings</span><span class="stat-value">${holdings}</span></div>
                <div class="stat-item"><span class="stat-label">Gratitude</span><span class="stat-value">${player.gratitudeTokens}</span></div>
                <div class="stat-item"><span class="stat-label">Shelters</span><span class="stat-value">${builtShelters}</span></div>
                <div class="stat-item"><span class="stat-label">Endowments</span><span class="stat-value">${endowments}</span></div>
                <div class="stat-item"><span class="stat-label">Space</span><span class="stat-value">${player.position}</span></div>
            </div>
            ${isMe ? `<button class="secondary-btn slim-btn" onclick="toggleNiyyah(${player.id})">${player.showNiyyahUI ? 'Hide Niyyah' : 'View Niyyah'}</button>` : ''}
            ${niyyahHtml}
        `;
        dom.playersDashboard.appendChild(card);

        const existing = document.getElementById(`token-${player.id}`);
        if (existing) existing.remove();

        const container = document.getElementById(`space-tokens-${player.position}`);
        if (container) {
            const token = document.createElement('div');
            token.className = 'token';
            token.id = `token-${player.id}`;
            token.style.backgroundColor = player.color;
            token.title = player.name;
            container.appendChild(token);
        }
    });

    state.board.forEach((entry, index) => {
        const badge = document.getElementById(`owner-badge-${index}`);
        if (!badge) return;

        const owner = state.players.find((player) => player.id === entry.ownerId);
        if (!owner) {
            badge.classList.add('hidden');
            badge.textContent = '';
            return;
        }

        badge.classList.remove('hidden');
        badge.style.background = owner.color;
        badge.textContent = `${owner.name}${entry.isEndowment ? ' Waqf' : entry.houses > 0 ? ` +${entry.houses}` : ''}`;
    });
}

function renderTurnState() {
    const activePlayer = state.players[state.turnIndex];
    dom.turnIndicator.textContent = activePlayer ? activePlayer.name : 'Waiting';
    dom.phaseIndicator.textContent = state.turnPhase || state.status;
    dom.lastRollIndicator.textContent = state.lastRoll ? `${state.lastRoll.d1} + ${state.lastRoll.d2}` : '-';
    updateDiceUI(state.lastRoll);
}

function renderInteraction() {
    const activePlayer = state.players[state.turnIndex];
    const me = getMe();
    const canAct = state.interaction && me && state.interaction.targetPlayerId === me.id;

    if (state.interaction) {
        dom.interaction.classList.remove('hidden');
        dom.intTitle.innerText = state.interaction.title;
        dom.intDesc.innerHTML = state.interaction.desc;
        dom.intButtons.innerHTML = '';

        if (canAct) {
            state.interaction.buttons.forEach((button) => {
                const btn = document.createElement('button');
                btn.innerText = button.label;
                btn.className = button.primary ? 'primary-btn' : 'secondary-btn';
                btn.onclick = () => socket.emit('submitAction', { actionId: button.actionId, payload: button.actionPayload });
                dom.intButtons.appendChild(btn);
            });
        } else {
            const waitingText = document.createElement('p');
            waitingText.className = 'waiting-copy';
            waitingText.textContent = `Waiting for ${state.players.find((player) => player.id === state.interaction.targetPlayerId)?.name || activePlayer?.name || 'another player'}...`;
            dom.intButtons.appendChild(waitingText);
        }
        return;
    }

    dom.interaction.classList.add('hidden');
}

function renderActionButtons() {
    const me = getMe();
    const activePlayer = state.players[state.turnIndex];
    const isMyTurn = me && activePlayer && me.id === activePlayer.id;
    const canRoll = isMyTurn && !state.interaction && !state.isGameOver && state.turnPhase === 'roll';

    dom.btnRoll.classList.toggle('hidden', !canRoll);
    dom.btnEnd.classList.add('hidden');
}

socket.on('connect', () => {});

dom.btnShowRules.addEventListener('click', () => dom.rulesModal.classList.remove('hidden'));
dom.btnCloseRules.addEventListener('click', () => dom.rulesModal.classList.add('hidden'));

dom.btnJoin.addEventListener('click', () => {
    const name = document.getElementById('player-name').value.trim();
    const color = document.getElementById('player-color').value;
    const code = document.getElementById('room-code-input').value.trim().toUpperCase();

    socket.emit('joinRoom', { name, color, roomCode: code });
    dom.lobbyScreen.classList.add('hidden');
    dom.waitingRoom.classList.remove('hidden');
});

dom.btnAddBot.addEventListener('click', () => socket.emit('addBot'));
dom.btnStart.addEventListener('click', () => socket.emit('startGame'));

dom.btnRoll.addEventListener('click', () => {
    dom.die1.classList.add('rolling');
    dom.die2.classList.add('rolling');

    setTimeout(() => {
        dom.die1.classList.remove('rolling');
        dom.die2.classList.remove('rolling');
        socket.emit('rollDice');
    }, 500);
});

socket.on('gameStateUpdate', (newState) => {
    if (state && state.players) {
        newState.players.forEach((incomingPlayer) => {
            const oldPlayer = state.players.find((entry) => entry.id === incomingPlayer.id);
            if (oldPlayer) incomingPlayer.showNiyyahUI = oldPlayer.showNiyyahUI;
        });
    }

    state = newState;

    if (state.status === 'lobby') {
        dom.dispRoomCode.innerText = state.code;
        dom.lobbyPlayersList.innerHTML = state.players.map((player) => `
            <li>
                <span class="waiting-dot" style="background:${player.color}"></span>
                ${player.name} ${player.socketId === socket.id ? '(You)' : ''} ${player.isBot ? '[Bot]' : ''}
            </li>
        `).join('');

        const isHost = state.host === socket.id;
        dom.btnStart.classList.toggle('hidden', !(isHost && state.players.length >= 2));
        return;
    }

    dom.lobbyScreen.classList.add('hidden');
    dom.waitingRoom.classList.add('hidden');
    dom.gameScreen.classList.remove('hidden');

    dom.commonWell.innerText = state.commonWell;
    dom.seedsCount.innerText = state.barakahBowl;

    renderDashboard();
    renderTurnState();
    renderInteraction();
    renderActionButtons();
    renderScoreboard();

    state.messages.forEach((message) => {
        if (!printedMessageIds.has(message.id)) {
            logMsgToDOM(message.msg, message.colorStr);
            printedMessageIds.add(message.id);
        }
    });
});
