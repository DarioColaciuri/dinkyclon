import React, { useEffect, useRef, useState } from "react";
import { ref, onValue, set, remove, get } from "firebase/database";
import { realtimeDb } from "../firebase/firebase";
import { useLocation, useNavigate } from "react-router-dom";
import "../css/Game.css";
import Level2 from "./levels/Level2";
import GameCanvas from "./GameCanvas";
import GameInfo from "./GameInfo";
import GameControls from "./GameControls";
import GameEnd from "./GameEnd";

const Game = () => {
  const canvasRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { gameId, user, opponent, isCreator } = location.state || {};

  const [playerCharacters, setPlayerCharacters] = useState([]);
  const [opponentCharacters, setOpponentCharacters] = useState([]);
  const [waitingForOpponent, setWaitingForOpponent] = useState(true);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [countdown, setCountdown] = useState(30);
  const [currentCharacterIndex, setCurrentCharacterIndex] = useState(0);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [playerImage, setPlayerImage] = useState(null);
  const [opponentImage, setOpponentImage] = useState(null);

  const gameRef = ref(realtimeDb, `games/${gameId}`);
  const playerRef = ref(
    realtimeDb,
    `games/${gameId}/player${isCreator ? "1" : "2"}`
  );
  const opponentRef = ref(
    realtimeDb,
    `games/${gameId}/player${isCreator ? "2" : "1"}`
  );
  const gameEndRef = ref(realtimeDb, `games/${gameId}/status`);
  const playerConnectionRef = ref(
    realtimeDb,
    `games/${gameId}/player${isCreator ? "1" : "2"}/connected`
  );
  const currentTurnRef = ref(realtimeDb, `games/${gameId}/currentTurn`);
  const currentCharacterIndexRef = ref(
    realtimeDb,
    `games/${gameId}/currentCharacterIndex`
  );
  const countdownRef = ref(realtimeDb, `games/${gameId}/countdown`);

  const map = Level2();

  useEffect(() => {
    const playerImg = new Image();
    playerImg.src = isCreator ? "/char1.png" : "/char2.png";
    playerImg.onload = () => setPlayerImage(playerImg);

    const opponentImg = new Image();
    opponentImg.src = isCreator ? "/char2.png" : "/char1.png";
    opponentImg.onload = () => setOpponentImage(opponentImg);
  }, [isCreator]);

  useEffect(() => {
    const level = 2;
    const image = new Image();
    image.src = `/back${level}.webp`;

    image.onload = () => setBackgroundImage(image);
    image.onerror = () => {
      console.warn(
        `No se pudo cargar la imagen de fondo para el nivel ${level}.`
      );
      setBackgroundImage(null);
    };
  }, []);

  useEffect(() => {
    const currentTurnListener = onValue(currentTurnRef, (snapshot) => {
      if (snapshot.exists()) setCurrentTurn(snapshot.val());
    });

    const currentCharacterIndexListener = onValue(
      currentCharacterIndexRef,
      (snapshot) => {
        if (snapshot.exists()) setCurrentCharacterIndex(snapshot.val());
      }
    );

    const countdownListener = onValue(countdownRef, (snapshot) => {
      if (snapshot.exists()) setCountdown(snapshot.val());
    });

    return () => {
      currentTurnListener();
      currentCharacterIndexListener();
      countdownListener();
    };
  }, []);

  useEffect(() => {
    if (currentTurn && !waitingForOpponent) {
      const interval = setInterval(async () => {
        const snapshot = await get(countdownRef);
        const currentCountdown = snapshot.val();

        if (currentCountdown === 0) {
          const nextTurn = currentTurn === user.uid ? opponent.uid : user.uid;
          const nextCharacterIndex = (currentCharacterIndex + 1) % 3;
          await set(currentTurnRef, nextTurn);
          await set(currentCharacterIndexRef, nextCharacterIndex);
          await set(countdownRef, 30);
        } else {
          await set(countdownRef, currentCountdown - 1);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [
    currentTurn,
    currentCharacterIndex,
    user.uid,
    opponent.uid,
    waitingForOpponent,
  ]);

  useEffect(() => {
    if (user?.uid) {
      set(playerConnectionRef, true);

      const playerCharactersListener = onValue(playerRef, (snapshot) => {
        if (snapshot.exists())
          setPlayerCharacters(snapshot.val().characters || []);
      });

      const opponentCharactersListener = onValue(opponentRef, (snapshot) => {
        if (snapshot.exists())
          setOpponentCharacters(snapshot.val().characters || []);
        else setOpponentCharacters([]);
      });

      const gameEndListener = onValue(gameEndRef, (snapshot) => {
        if (snapshot.exists() && snapshot.val() === "ended") {
          alert("El oponente ha abandonado la partida.");
          handleEndGame();
        }
      });

      return () => {
        remove(playerConnectionRef);
        playerCharactersListener();
        opponentCharactersListener();
        gameEndListener();
      };
    }
  }, [gameId, user?.uid, isCreator]);

  useEffect(() => {
    if (opponentRef) {
      const timeout = setTimeout(() => {
        alert("El oponente no se ha conectado a tiempo.");
        handleEndGame();
      }, 10000);

      const opponentConnectionRef = ref(
        realtimeDb,
        `games/${gameId}/player${isCreator ? "2" : "1"}/connected`
      );
      const opponentConnectionListener = onValue(
        opponentConnectionRef,
        (snapshot) => {
          if (snapshot.exists() && snapshot.val() === true) {
            clearTimeout(timeout);
            setWaitingForOpponent(false);
          }
        }
      );

      return () => {
        clearTimeout(timeout);
        opponentConnectionListener();
      };
    }
  }, [gameId, isCreator]);

  const handleEndGame = async () => {
    await set(gameEndRef, "ended");
    await remove(gameRef);

    const playerMatchmakingRef = ref(realtimeDb, `matchmaking/${user.uid}`);
    const opponentMatchmakingRef = ref(
      realtimeDb,
      `matchmaking/${opponent?.uid}`
    );
    await remove(playerMatchmakingRef);
    if (opponent?.uid) await remove(opponentMatchmakingRef);

    await remove(playerConnectionRef);
    setOpponentCharacters([]);

    navigate("/lobby");
  };

  return (
    <div className="game-container">
      {waitingForOpponent ? (
        <p>Esperando al oponente...</p>
      ) : (
        <>
          <GameInfo
            currentTurn={currentTurn}
            user={user}
            opponent={opponent}
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
          />
          <GameControls
            currentTurn={currentTurn}
            user={user}
            playerRef={playerRef}
            currentCharacterIndex={currentCharacterIndex}
            map={map}
          />
          <GameEnd handleEndGame={handleEndGame} />
        </>
      )}
    </div>
  );
};

export default Game;
