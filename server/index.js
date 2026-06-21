import { WebSocketServer } from "ws";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3001;
const mapData = JSON.parse(readFileSync(join(__dirname, "map.json"), "utf-8"));
const MAP = mapData.map;

const GRAVITY = 0.5;
const JUMP_STRENGTH = -10;
const TILE_SIZE = 10;
const MOVE_AMOUNT = 5;
const BASE_PROJECTILE_SPEED = 5;
const MAX_PROJECTILE_SPEED = 20;
const MAX_CHARGE_TIME = 1000;
const MAP_COLS = 80;
const TICK_RATE = 30;
const MATCH_ACCEPT_TIMEOUT = 10000;
const DISCONNECT_GRACE = 5000;
const ELO_K = 32;

const clients = new Map();
const matchmakingQueue = [];
const pendingMatches = new Map();
const games = new Map();

function checkCollision(x, y, w = 30, h = 40) {
  if (x < 0 || y < 0) return true;
  for (let dx = 0; dx < w; dx += TILE_SIZE) {
    for (let dy = 0; dy < h; dy += TILE_SIZE) {
      const col = Math.floor((x + dx) / TILE_SIZE);
      const row = Math.floor((y + dy) / TILE_SIZE);
      const index = row * MAP_COLS + col;
      if (index >= 0 && index < MAP.length && MAP[index] === 1) return true;
    }
  }
  return false;
}

function checkProjectileCollision(x, y) {
  return checkCollision(x, y, 10, 10);
}

function checkCharacterHit(projX, projY, char) {
  return (
    projX >= char.position.x &&
    projX <= char.position.x + 30 &&
    projY >= char.position.y &&
    projY <= char.position.y + 40
  );
}

function addExplosion(game, x, y) {
  if (!game.explosions) game.explosions = [];
  game.explosions.push({ x, y, size: 10, maxSize: 30, alpha: 0.8, createdAt: Date.now() });
}

function updateExplosions(game) {
  if (!game.explosions) return;
  game.explosions = game.explosions
    .map((e) => ({ ...e, size: Math.min(e.size + 3, e.maxSize), alpha: e.alpha - 0.03 }))
    .filter((e) => e.alpha > 0);
}

function getPlayer(game, uid) {
  return game.player1.uid === uid ? game.player1 : game.player2;
}

function getOpponent(game, uid) {
  return game.player1.uid === uid ? game.player2 : game.player1;
}

function allCharactersDead(player) {
  return player.characters.every((c) => (c.life ?? 100) <= 0);
}

function sanitizeCharacters(chars) {
  return chars.map((c) => ({
    position: { x: c.position.x, y: c.position.y },
    life: c.life ?? 100,
    aimAngle: c.aimAngle,
    projectiles: (c.projectiles || []).map((p) => ({
      x: p.x, y: p.y, velocityX: p.velocityX, velocityY: p.velocityY, active: p.active,
    })),
  }));
}

function buildStateForPlayer(game, uid) {
  const player = getPlayer(game, uid);
  const opponent = getOpponent(game, uid);
  return {
    type: "game_state",
    playerCharacters: sanitizeCharacters(player.characters),
    opponentCharacters: sanitizeCharacters(opponent.characters),
    currentTurn: game.currentTurn,
    currentCharacterIndex: player.currentCharacterIndex,
    opponentCharacterIndex: opponent.currentCharacterIndex,
    countdown: game.countdown,
    chargeProgress: game.chargeProgress?.[game.currentTurn] || 0,
    explosions: game.explosions || [],
    opponent: { uid: opponent.uid, nickname: opponent.nickname, elo: opponent.elo },
  };
}

function broadcastGameState(game) {
  [game.player1, game.player2].forEach((p) => {
    if (p.ws && p.ws.readyState === 1) {
      const state = buildStateForPlayer(game, p.uid);
      try { p.ws.send(JSON.stringify(state)); } catch (_) {}
    }
  });
}

function getNextAliveIndex(player, startIndex) {
  for (let i = 0; i < 3; i++) {
    const idx = (startIndex + i) % 3;
    if ((player.characters[idx].life ?? 100) > 0) return idx;
  }
  return startIndex;
}

function switchTurn(game) {
  const nextTurn = game.currentTurn === game.player1.uid ? game.player2.uid : game.player1.uid;
  const nextPlayer = nextTurn === game.player1.uid ? game.player1 : game.player2;

  let nextIndex = (nextPlayer.currentCharacterIndex + 1) % 3;
  nextIndex = getNextAliveIndex(nextPlayer, nextIndex);
  nextPlayer.currentCharacterIndex = nextIndex;

  game.currentTurn = nextTurn;
  game.countdown = 30;
  game.isCharging = {};
  game.chargeProgress = {};
  game.chargeStart = {};
  game.canShoot = { [game.player1.uid]: true, [game.player2.uid]: true };
  game.firedThisTurn = {};
  game.keys[game.player1.uid] = {};
  game.keys[game.player2.uid] = {};
}

function calculateElo(winnerElo, loserElo) {
  const expected = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const delta = Math.round(ELO_K * (1 - expected));
  return {
    winnerNewElo: winnerElo + delta,
    loserNewElo: Math.max(0, loserElo - delta),
  };
}

function processGameTick(game) {
  if (game.status !== "in_progress") return;

  const activePlayer = game.currentTurn === game.player1.uid ? game.player1 : game.player2;
  const inactivePlayer = game.currentTurn === game.player1.uid ? game.player2 : game.player1;
  const activeCharIndex = activePlayer.currentCharacterIndex;
  const keys = (game.keys && game.keys[activePlayer.uid]) || {};
  const isCreator = activePlayer.uid === game.player1.uid;

  activePlayer.characters = activePlayer.characters.map((char, idx) => {
    char = { ...char, velocityY: char.velocityY || 0 };
      if (idx === activeCharIndex && (char.life ?? 100) > 0) {
      if (char.aimAngle === undefined) char.aimAngle = isCreator ? 0 : 180;
      let newX = char.position.x;
      if (keys.a) newX -= MOVE_AMOUNT;
      if (keys.d) newX += MOVE_AMOUNT;
      if (keys.space && checkCollision(char.position.x, char.position.y + 1)) {
        char.velocityY = JUMP_STRENGTH;
      }
      if (!checkCollision(newX, char.position.y)) {
        char.position = { ...char.position, x: newX };
      }
      const aimDelta = (keys.w ? -2 : 0) + (keys.s ? 2 : 0);
      if (aimDelta !== 0) {
        const adjusted = isCreator ? aimDelta : -aimDelta;
        char.aimAngle = (char.aimAngle || (isCreator ? 0 : 180)) + adjusted;
        if (char.aimAngle < 0) char.aimAngle += 360;
        if (char.aimAngle >= 360) char.aimAngle -= 360;
      }
    }
    let newY = char.position.y + (char.velocityY || 0);
    if (!checkCollision(char.position.x, newY)) {
      char.velocityY = (char.velocityY || 0) + GRAVITY;
      char.position = { ...char.position, y: newY };
    } else {
      char.velocityY = 0;
    }
    if (char.projectiles && char.projectiles.length > 0) {
      char.projectiles = char.projectiles
        .map((p) => {
          if (!p.active) return p;
          p = { ...p, velocityY: (p.velocityY || 0) + GRAVITY * 0.5 };
          const nextX = p.x + p.velocityX;
          const nextY = p.y + p.velocityY;
          if (checkProjectileCollision(nextX, nextY)) {
            addExplosion(game, p.x, p.y);
            return { ...p, active: false };
          }
          const hitIdx = inactivePlayer.characters.findIndex((c) => checkCharacterHit(nextX, nextY, c));
          if (hitIdx >= 0) {
            addExplosion(game, p.x, p.y);
            inactivePlayer.characters[hitIdx] = {
              ...inactivePlayer.characters[hitIdx],
              life: Math.max(0, (inactivePlayer.characters[hitIdx].life ?? 100) - 100),
            };
            return { ...p, active: false };
          }
          const prevTicks = p.ticksAlive || 0;
          const allyIdx = activePlayer.characters.findIndex(
            (c, ci) => checkCharacterHit(nextX, nextY, c)
          );
          if (allyIdx >= 0) {
            if (prevTicks === 0 && allyIdx === activeCharIndex) {
              // skip self-hit on first tick only
            } else {
              addExplosion(game, p.x, p.y);
              activePlayer.characters[allyIdx] = {
                ...activePlayer.characters[allyIdx],
                life: Math.max(0, (activePlayer.characters[allyIdx].life ?? 100) - 100),
              };
              return { ...p, active: false };
            }
          }
          return { ...p, x: nextX, y: nextY, ticksAlive: prevTicks + 1 };
        })
        .filter((p) => p.active);
    }
    return char;
  });

  inactivePlayer.characters = inactivePlayer.characters.map((char) => {
    char = { ...char, velocityY: char.velocityY || 0 };
    if (char.projectiles && char.projectiles.length > 0) {
      char.projectiles = char.projectiles
        .map((p) => {
          if (!p.active) return p;
          p = { ...p, velocityY: (p.velocityY || 0) + GRAVITY * 0.5 };
          const nextX = p.x + p.velocityX;
          const nextY = p.y + p.velocityY;
          if (checkProjectileCollision(nextX, nextY)) {
            addExplosion(game, p.x, p.y);
            return { ...p, active: false };
          }
          const hitIdx = activePlayer.characters.findIndex((c) => checkCharacterHit(nextX, nextY, c));
          if (hitIdx >= 0) {
            addExplosion(game, p.x, p.y);
            activePlayer.characters[hitIdx] = {
              ...activePlayer.characters[hitIdx],
              life: Math.max(0, (activePlayer.characters[hitIdx].life ?? 100) - 100),
            };
            return { ...p, active: false };
          }
          return { ...p, x: nextX, y: nextY, ticksAlive: (p.ticksAlive || 0) + 1 };
        })
        .filter((p) => p.active);
    }
    let newY = char.position.y + (char.velocityY || 0);
    if (!checkCollision(char.position.x, newY)) {
      char.velocityY = (char.velocityY || 0) + GRAVITY;
      char.position = { ...char.position, y: newY };
    } else {
      char.velocityY = 0;
    }
    return char;
  });

  updateExplosions(game);

  if (allCharactersDead(game.player1) || allCharactersDead(game.player2)) {
    endGame(game, "victory");
    return;
  }

  const activeChar = activePlayer.characters[activeCharIndex];
  if (activeChar && (activeChar.life ?? 100) <= 0) {
    const nextAlive = getNextAliveIndex(activePlayer, activeCharIndex);
    if (nextAlive === activeCharIndex && (activePlayer.characters[nextAlive].life ?? 100) <= 0) {
      endGame(game, "victory");
      return;
    }
    activePlayer.currentCharacterIndex = nextAlive;
  }

  if (game.chargeProgress) {
    for (const uid of [game.player1.uid, game.player2.uid]) {
      if (game.isCharging?.[uid]) {
        game.chargeProgress[uid] = Math.min((Date.now() - game.chargeStart[uid]) / MAX_CHARGE_TIME, 1);
      }
    }
  }

  if (game.firedThisTurn?.[activePlayer.uid]) {
    const anyActive = activePlayer.characters.some((c) =>
      (c.projectiles || []).some((p) => p.active)
    );
    if (!anyActive) {
      switchTurn(game);
    }
  }

  broadcastGameState(game);
}

function startGameLoop(game) {
  game.keys = {};
  game.keys[game.player1.uid] = {};
  game.keys[game.player2.uid] = {};
  game.chargeProgress = {};
  game.chargeStart = {};
  game.isCharging = {};
  game.canShoot = { [game.player1.uid]: true, [game.player2.uid]: true };
  game.firedThisTurn = {};

  game.gameLoopInterval = setInterval(() => {
    if (game.status === "ended") {
      stopGameLoop(game);
      return;
    }
    processGameTick(game);
  }, TICK_RATE);

  game.countdownInterval = setInterval(() => {
    if (game.status !== "in_progress") return;
    game.countdown -= 1;
    if (game.countdown <= 0) {
      switchTurn(game);
    }
  }, 1000);
}

function stopGameLoop(game) {
  clearInterval(game.gameLoopInterval);
  clearInterval(game.countdownInterval);
}

function endGame(game, reason, quitterUid) {
  if (game.status === "ended") return;
  game.status = "ended";
  stopGameLoop(game);

  const msg = { type: "game_ended", reason };

  let winner, loser;

  if (reason === "victory") {
    winner = allCharactersDead(game.player1) ? game.player2 : game.player1;
    loser = allCharactersDead(game.player1) ? game.player1 : game.player2;
  } else if (reason === "player_left" && quitterUid) {
    loser = game.player1.uid === quitterUid ? game.player1 : game.player2;
    winner = game.player1.uid === quitterUid ? game.player2 : game.player1;
  } else if (reason === "opponent_disconnected") {
    winner = game.player1.ws ? game.player1 : game.player2;
    loser = game.player1.ws ? game.player2 : game.player1;
  }

  if (winner && loser) {
    const { winnerNewElo, loserNewElo } = calculateElo(winner.elo, loser.elo);
    const eloDelta = winnerNewElo - winner.elo;
    msg.winner = winner.uid;
    msg.quitter = quitterUid || null;
    msg.eloDelta = eloDelta;
    msg.eloUpdate = {
      [winner.uid]: winnerNewElo,
      [loser.uid]: loserNewElo,
    };
  }

  [game.player1, game.player2].forEach((p) => {
    if (p.ws && p.ws.readyState === 1) {
      try { p.ws.send(JSON.stringify(msg)); } catch (_) {}
    }
  });

  games.delete(game.gameId);

  [game.player1, game.player2].forEach((p) => {
    const client = clients.get(p.uid);
    if (client) client.currentGame = null;
  });
}

function sendTo(ws, msg) {
  if (ws && ws.readyState === 1) {
    try { ws.send(JSON.stringify(msg)); } catch (_) {}
  }
}

function handleDisconnect(uid) {
  const client = clients.get(uid);
  if (!client) return;

  const queueIdx = matchmakingQueue.findIndex((p) => p.uid === uid);
  if (queueIdx >= 0) {
    matchmakingQueue.splice(queueIdx, 1);
    clients.delete(uid);
    return;
  }

  const pending = pendingMatches.get(uid);
  if (pending) {
    clearTimeout(pending.timeout);
    pendingMatches.delete(uid);
    const oppPending = pendingMatches.get(pending.opponentUid);
    if (oppPending) {
      clearTimeout(oppPending.timeout);
      pendingMatches.delete(pending.opponentUid);
      const oppClient = clients.get(pending.opponentUid);
      if (oppClient) sendTo(oppClient.ws, { type: "match_cancelled", reason: "opponent_disconnected" });
    }
    clients.delete(uid);
    return;
  }

  if (client.currentGame) {
    const game = games.get(client.currentGame);
    if (!game || game.status === "ended") {
      clients.delete(uid);
      return;
    }
    client._disconnectTimeout = setTimeout(() => {
      const currentGame = games.get(client.currentGame);
      if (currentGame && currentGame.status !== "ended") {
        endGame(currentGame, "opponent_disconnected");
      }
      clients.delete(uid);
    }, DISCONNECT_GRACE);
    client.ws = null;
  } else {
    clients.delete(uid);
  }
}

function tryPairPlayers() {
  if (matchmakingQueue.length < 2) return;

  const p1 = matchmakingQueue.shift();
  const p2 = matchmakingQueue.shift();

  const matchTimeout = setTimeout(() => {
    const m1 = pendingMatches.get(p1.uid);
    const m2 = pendingMatches.get(p2.uid);
    if (m1) {
      pendingMatches.delete(p1.uid);
      sendTo(p1.ws, { type: "match_cancelled", reason: "timeout" });
    }
    if (m2) {
      pendingMatches.delete(p2.uid);
      sendTo(p2.ws, { type: "match_cancelled", reason: "timeout" });
    }
  }, MATCH_ACCEPT_TIMEOUT);

  pendingMatches.set(p1.uid, { opponentUid: p2.uid, accepted: false, timeout: matchTimeout, isFirst: true });
  pendingMatches.set(p2.uid, { opponentUid: p1.uid, accepted: false, timeout: matchTimeout, isFirst: false });

  sendTo(p1.ws, { type: "match_found", opponent: { uid: p2.uid, nickname: p2.nickname, elo: p2.elo } });
  sendTo(p2.ws, { type: "match_found", opponent: { uid: p1.uid, nickname: p1.nickname, elo: p1.elo } });
}

function handleMatchResponse(ws, uid, action) {
  const pending = pendingMatches.get(uid);
  if (!pending) return;

  if (action === "reject") {
    clearTimeout(pending.timeout);
    pendingMatches.delete(uid);
    const oppPending = pendingMatches.get(pending.opponentUid);
    if (oppPending) {
      clearTimeout(oppPending.timeout);
      pendingMatches.delete(pending.opponentUid);
      const oppClient = clients.get(pending.opponentUid);
      if (oppClient) sendTo(oppClient.ws, { type: "match_cancelled", reason: "rejected" });
    }
    return;
  }

  if (action === "accept") {
    pending.accepted = true;
    const oppPending = pendingMatches.get(pending.opponentUid);
    if (oppPending && oppPending.accepted) {
      clearTimeout(pending.timeout);
      clearTimeout(oppPending.timeout);
      pendingMatches.delete(uid);
      pendingMatches.delete(pending.opponentUid);

      const ids = [uid, pending.opponentUid].sort();
      const gameId = ids.join("_");

      const firstUid = pending.isFirst ? uid : pending.opponentUid;
      const secondUid = pending.isFirst ? pending.opponentUid : uid;

      const firstClient = clients.get(firstUid);
      const secondClient = clients.get(secondUid);
      if (!firstClient || !secondClient) return;

      const game = {
        gameId,
        status: "in_progress",
        player1: {
          uid: firstUid,
          nickname: firstClient.nickname,
          elo: firstClient.elo,
          ws: firstClient.ws,
          connected: true,
          characters: [
            { position: { x: 80, y: 100 }, life: 100 },
            { position: { x: 120, y: 200 }, life: 100 },
            { position: { x: 160, y: 300 }, life: 100 },
          ],
        },
        player2: {
          uid: secondUid,
          nickname: secondClient.nickname,
          elo: secondClient.elo,
          ws: secondClient.ws,
          connected: true,
          characters: [
            { position: { x: 600, y: 100 }, life: 100 },
            { position: { x: 640, y: 200 }, life: 100 },
            { position: { x: 680, y: 300 }, life: 100 },
          ],
        },
        currentTurn: firstUid,
        countdown: 30,
        explosions: [],
      };

      game.player1.currentCharacterIndex = 0;
      game.player2.currentCharacterIndex = 0;

      games.set(gameId, game);
      firstClient.currentGame = gameId;
      secondClient.currentGame = gameId;

      startGameLoop(game);

      [game.player1, game.player2].forEach((p) => {
        const opp = p.uid === game.player1.uid ? game.player2 : game.player1;
        sendTo(p.ws, {
          type: "game_start",
          gameId,
          isCreator: p.uid === game.player1.uid,
          opponent: { uid: opp.uid, nickname: opp.nickname, elo: opp.elo },
        });
      });
    }
  }
}

function handleInput(ws, uid, inputAction, key) {
  const client = clients.get(uid);
  if (!client || !client.currentGame) return;

  const game = games.get(client.currentGame);
  if (!game || game.status !== "in_progress") return;
  if (game.currentTurn !== uid) return;

  if (!game.keys[uid]) game.keys[uid] = {};
  const isCreator = uid === game.player1.uid;

  if (inputAction === "keydown") {
    game.keys[uid][key] = true;

    if (key === "control" && !game.isCharging[uid]) {
      if (game.firedThisTurn?.[uid]) return;
      game.isCharging[uid] = true;
      game.chargeStart[uid] = Date.now();
      game.chargeProgress[uid] = 0;
    }

    if (key === "w" || key === "s") {
      const player = getPlayer(game, uid);
      const char = player.characters[player.currentCharacterIndex];
      if (char && (char.life ?? 100) > 0) {
        const aimDelta = key === "w" ? -1 : 1;
        const adjusted = isCreator ? aimDelta : -aimDelta;
        char.aimAngle = (char.aimAngle || (isCreator ? 0 : 180)) + adjusted;
        if (char.aimAngle < 0) char.aimAngle += 360;
        if (char.aimAngle >= 360) char.aimAngle -= 360;
      }
    }
  } else if (inputAction === "keyup") {
    game.keys[uid][key] = false;

    if (key === "control" && game.isCharging[uid]) {
      const chargeTime = Date.now() - game.chargeStart[uid];
      const normalized = Math.min(chargeTime, MAX_CHARGE_TIME) / MAX_CHARGE_TIME;
      const speed = BASE_PROJECTILE_SPEED + (MAX_PROJECTILE_SPEED - BASE_PROJECTILE_SPEED) * normalized;

      const player = getPlayer(game, uid);
      const char = player.characters[player.currentCharacterIndex];
      if (char && (char.life ?? 100) > 0) {
        const angle = ((char.aimAngle || (isCreator ? 0 : 180)) * Math.PI) / 180;
        const spawnX = isCreator ? char.position.x + 32 : char.position.x - 12;
        const spawnY = char.position.y + 20;
        char.projectiles = [
          ...(char.projectiles || []),
          {
            x: spawnX,
            y: spawnY,
            velocityX: Math.cos(angle) * speed,
            velocityY: Math.sin(angle) * speed,
            active: true,
            ticksAlive: 0,
          },
        ];
        game.canShoot[uid] = false;
        game.firedThisTurn[uid] = true;
      }
      game.isCharging[uid] = false;
      game.chargeProgress[uid] = 0;
    }
  }
}

function handleMessage(ws, rawMsg) {
  let msg;
  try { msg = JSON.parse(rawMsg); } catch { return; }

  switch (msg.type) {
    case "auth_data": {
      const { uid, nickname, elo } = msg;
      if (!uid) return;

      let client = clients.get(uid);
      if (client) {
        clearTimeout(client._disconnectTimeout);
        client.ws = ws;
        client.nickname = nickname || client.nickname;
        client.elo = elo || client.elo;
        if (client.currentGame) {
          const game = games.get(client.currentGame);
          if (game) {
            if (game.player1.uid === uid) game.player1.ws = ws;
            if (game.player2.uid === uid) game.player2.ws = ws;
          }
        }
      } else {
        client = { ws, nickname: nickname || "", elo: elo || 500 };
        clients.set(uid, client);
      }
      ws._uid = uid;
      break;
    }

    case "matchmaking": {
      const { action } = msg;
      const uid = ws._uid;
      if (!uid) return;

      if (action === "search") {
        const client = clients.get(uid);
        if (!client) return;
        const alreadyInQueue = matchmakingQueue.findIndex((p) => p.uid === uid);
        if (alreadyInQueue >= 0) matchmakingQueue.splice(alreadyInQueue, 1);
        matchmakingQueue.push({ uid, nickname: client.nickname, elo: client.elo, ws });
        sendTo(ws, { type: "match_status", status: "searching" });
        tryPairPlayers();
      } else if (action === "cancel") {
        const idx = matchmakingQueue.findIndex((p) => p.uid === uid);
        if (idx >= 0) matchmakingQueue.splice(idx, 1);
        const pending = pendingMatches.get(uid);
        if (pending) {
          clearTimeout(pending.timeout);
          pendingMatches.delete(uid);
          const oppPending = pendingMatches.get(pending.opponentUid);
          if (oppPending) {
            clearTimeout(oppPending.timeout);
            pendingMatches.delete(pending.opponentUid);
            const oppClient = clients.get(pending.opponentUid);
            if (oppClient) sendTo(oppClient.ws, { type: "match_cancelled", reason: "opponent_cancelled" });
          }
        }
        sendTo(ws, { type: "match_status", status: "cancelled" });
      }
      break;
    }

    case "match_response": {
      const { action } = msg;
      const uid = ws._uid;
      if (!uid) return;
      handleMatchResponse(ws, uid, action);
      break;
    }

    case "input": {
      const { action, key } = msg;
      const uid = ws._uid;
      if (!uid) return;
      handleInput(ws, uid, action, key);
      break;
    }

    case "end_game": {
      const uid = ws._uid;
      if (!uid) return;
      const client = clients.get(uid);
      if (client?.currentGame) {
        const game = games.get(client.currentGame);
        if (game) endGame(game, "player_left", uid);
      }
      break;
    }
  }
}

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => {
  ws.on("message", (data) => handleMessage(ws, data.toString()));
  ws.on("close", () => { if (ws._uid) handleDisconnect(ws._uid); });
  ws.on("error", () => { if (ws._uid) handleDisconnect(ws._uid); });
});

console.log(`Servidor WebSocket en ws://localhost:${PORT}`);
