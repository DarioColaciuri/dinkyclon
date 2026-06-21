import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabase/supabase";
import "../css/Game.css";
import Level2 from "./levels/Level2";
import GameCanvas from "./GameCanvas";
import GameInfo from "./GameInfo";
import GameControls from "./GameControls";
import GameEnd from "./GameEnd";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3001";
const DEATH_ANIM_MS = 600;

const Game = () => {
  const canvasRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { gameId, user, opponent, isCreator } = location.state || {};

  const [playerCharacters, setPlayerCharacters] = useState([]);
  const [opponentCharacters, setOpponentCharacters] = useState([]);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [countdown, setCountdown] = useState(30);
  const [currentCharacterIndex, setCurrentCharacterIndex] = useState(0);
  const [opponentCharacterIndex, setOpponentCharacterIndex] = useState(0);
  const [chargeProgress, setChargeProgress] = useState(0);
  const [explosions, setExplosions] = useState([]);
  const [gameOpponent, setGameOpponent] = useState(opponent);
  const [gameStarted, setGameStarted] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [playerImage, setPlayerImage] = useState(null);
  const [opponentImage, setOpponentImage] = useState(null);
  const [dyingCharacters, setDyingCharacters] = useState([]);
  const [gameResult, setGameResult] = useState(null);
  const [ws, setWs] = useState(null);
  const eloUpdateRef = useRef(null);

  const prevLivesRef = useRef({ player: [100, 100, 100], opponent: [100, 100, 100] });

  const map = Level2();

  useEffect(() => {
    const playerImg = new Image();
    playerImg.src = isCreator ? "/char1.png" : "/char2.png";
    playerImg.onload = () => setPlayerImage(playerImg);

    const opponentImg = new Image();
    opponentImg.src = isCreator ? "/char2.png" : "/char1.png";
    opponentImg.onload = () => setOpponentImage(opponentImg);

    const bgImg = new Image();
    bgImg.src = "/back2.webp";
    bgImg.onload = () => setBackgroundImage(bgImg);
    bgImg.onerror = () => setBackgroundImage(null);
  }, [isCreator]);

  useEffect(() => {
    if (!user || !gameId) {
      navigate("/lobby");
      return;
    }

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setWs(ws);
      ws.send(JSON.stringify({ type: "auth_data", uid: user.uid }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "game_state":
          setPlayerCharacters(msg.playerCharacters);
          setOpponentCharacters(msg.opponentCharacters);
          setCurrentTurn(msg.currentTurn);
          setCurrentCharacterIndex(msg.currentCharacterIndex);
          setOpponentCharacterIndex(msg.opponentCharacterIndex || 0);
          setCountdown(msg.countdown);
          setChargeProgress(msg.chargeProgress);
          setExplosions(msg.explosions);
          if (msg.opponent) setGameOpponent(msg.opponent);

          detectDeaths(msg.playerCharacters, "player");
          detectDeaths(msg.opponentCharacters, "opponent");

          setGameStarted(true);
          break;

        case "game_ended":
          eloUpdateRef.current = msg.eloUpdate
            ? { elo: msg.eloUpdate[user.uid], uid: user.uid }
            : null;
          setGameResult({
            reason: msg.reason,
            won: msg.winner === user.uid,
            isQuitter: msg.quitter === user.uid,
            eloDelta: msg.eloDelta || 0,
            newElo: msg.eloUpdate?.[user.uid] ?? null,
          });
          break;
      }
    };

    return () => {
      ws.close();
    };
  }, [user, gameId, navigate]);

  const detectDeaths = (chars, side) => {
    const prevLives = side === "player" ? prevLivesRef.current.player : prevLivesRef.current.opponent;
    const newDying = [];

    chars.forEach((c, i) => {
      if (prevLives[i] > 0 && (c.life ?? 100) <= 0) {
        newDying.push({ side, index: i, startTime: Date.now() });
      }
    });

    if (newDying.length > 0) {
      setDyingCharacters((prev) => [...prev, ...newDying]);
      newDying.forEach((d) => {
        setTimeout(() => {
          setDyingCharacters((prev) => prev.filter((x) => x !== d));
        }, DEATH_ANIM_MS);
      });
    }

    prevLivesRef.current[side] = chars.map((c) => c.life ?? 100);
  };

  const handleEndGame = () => {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "end_game" }));
    }
  };

  const handleReturnToLobby = async () => {
    if (eloUpdateRef.current) {
      const { elo, uid } = eloUpdateRef.current;
      await supabase
        .from("profiles")
        .update({ elo })
        .eq("id", uid);
    }
    navigate("/lobby");
  };

  return (
    <div className="game-container">
      {!gameStarted ? (
        <p>Conectando al servidor...</p>
      ) : (
        <>
          <GameInfo
            currentTurn={currentTurn}
            user={user}
            opponent={gameOpponent}
            countdown={countdown}
            currentCharacterIndex={currentCharacterIndex}
          />
          <GameCanvas
            canvasRef={canvasRef}
            backgroundImage={backgroundImage}
            map={map}
            playerCharacters={playerCharacters}
            opponentCharacters={opponentCharacters}
            playerImage={playerImage}
            opponentImage={opponentImage}
            currentTurn={currentTurn}
            user={user}
            currentCharacterIndex={currentCharacterIndex}
            opponentCharacterIndex={opponentCharacterIndex}
            chargeProgress={chargeProgress}
            explosions={explosions}
            dyingCharacters={dyingCharacters}
          />
          <GameControls
            ws={ws}
            currentTurn={currentTurn}
            user={user}
          />
          <GameEnd handleEndGame={handleEndGame} />

          {gameResult && (
            <div className="result-overlay">
              <div className="result-card">
                <h1 className={gameResult.won ? "result-win" : "result-lose"}>
                  {gameResult.reason === "victory"
                    ? gameResult.won
                      ? "GANASTE"
                      : "PERDISTE"
                    : gameResult.isQuitter
                      ? "TE HAS RETIRADO"
                      : "TU OPONENTE SE RETIRO"}
                </h1>

                <div className="result-elo">
                  <span className={gameResult.won ? "elo-positive" : "elo-negative"}>
                    {gameResult.won ? "+" : "-"}{gameResult.eloDelta} ELO
                  </span>
                  {gameResult.newElo !== null && (
                    <span className="elo-new">Nuevo ELO: {gameResult.newElo}</span>
                  )}
                </div>

                <button className="result-button" onClick={handleReturnToLobby}>
                  Volver al lobby
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Game;
