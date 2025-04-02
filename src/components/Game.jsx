import React, { useEffect, useRef, useState } from "react";
import {
  ref,
  onValue,
  set,
  remove,
  get,
  onChildAdded,
  runTransaction,
} from "firebase/database";
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
  const [chargeProgress, setChargeProgress] = useState(0);

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
  const opponentConnectionRef = ref(
    realtimeDb,
    `games/${gameId}/player${isCreator ? "2" : "1"}/connected`
  );
  const currentTurnRef = ref(realtimeDb, `games/${gameId}/currentTurn`);
  const currentCharacterIndexRef = ref(
    realtimeDb,
    `games/${gameId}/currentCharacterIndex`
  );
  const countdownRef = ref(realtimeDb, `games/${gameId}/countdown`);
  const damageQueueRef = ref(realtimeDb, `games/${gameId}/damageQueue`);

  const map = Level2();

  useEffect(() => {
    const processDamageQueue = onChildAdded(
      damageQueueRef,
      async (snapshot) => {
        const { target, characterIndex, amount, isAlly } = snapshot.val();
        const targetRef = ref(
          realtimeDb,
          `games/${gameId}/${target}/characters/${characterIndex}`
        );

        try {
          // Verificación adicional para ver el estado actual
          const currentChar = await get(targetRef);
          console.log("Vida antes del daño:", currentChar.val()?.life);

          await runTransaction(targetRef, (character) => {
            if (!character) return null;
            const newLife = Math.max(0, (character.life || 100) - amount);

            // Debug adicional
            console.log(
              `Aplicando ${amount} de daño a ${target}-${characterIndex}`,
              {
                vidaAnterior: character.life,
                nuevaVida: newLife,
                esAliado: isAlly,
              }
            );

            return { ...character, life: newLife };
          });

          // Verificación después de la transacción
          const updatedChar = await get(targetRef);
          console.log("Vida después del daño:", updatedChar.val()?.life);
        } catch (error) {
          console.error("Error al procesar daño:", error);
        } finally {
          await remove(snapshot.ref);
        }
      }
    );

    return () => processDamageQueue();
  }, [gameId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      alert("El oponente no se ha conectado a tiempo.");
      handleEndGame();
    }, 10000);

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
  }, [gameId, isCreator]);

  useEffect(() => {
    const gameEndListener = onValue(gameEndRef, (snapshot) => {
      if (snapshot.exists() && snapshot.val() === "ended") {
        alert("El oponente ha abandonado la partida.");
        navigate("/lobby");
      }
    });

    return () => gameEndListener();
  }, [navigate]);

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
    if (user?.uid) {
      set(playerConnectionRef, true);

      const playerCharactersListener = onValue(playerRef, (snapshot) => {
        if (snapshot.exists())
          setPlayerCharacters(snapshot.val().characters || []);
      });

      const opponentCharactersListener = onValue(opponentRef, (snapshot) => {
        if (snapshot.exists())
          setOpponentCharacters(snapshot.val().characters || []);
      });

      return () => {
        remove(playerConnectionRef);
        playerCharactersListener();
        opponentCharactersListener();
      };
    }
  }, [gameId, user?.uid, isCreator]);

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
    user?.uid,
    opponent?.uid,
    waitingForOpponent,
  ]);

  const handleEndGame = async () => {
    try {
      const gameSnapshot = await get(gameRef);
      if (!gameSnapshot.exists()) {
        navigate("/lobby");
        return;
      }

      await set(gameEndRef, "ended");
      await remove(gameRef);

      const playerMatchmakingRef = ref(realtimeDb, `matchmaking/${user.uid}`);
      const opponentMatchmakingRef = ref(
        realtimeDb,
        `matchmaking/${opponent?.uid}`
      );

      await remove(playerMatchmakingRef);
      if (opponent?.uid) await remove(opponentMatchmakingRef);

      navigate("/lobby");
    } catch (error) {
      alert("Hubo un error al finalizar la partida. Inténtalo de nuevo.");
    }
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
            currentTurn={currentTurn}
            user={user}
            currentCharacterIndex={currentCharacterIndex}
            chargeProgress={chargeProgress}
          />
          <GameControls
            currentTurn={currentTurn}
            user={user}
            playerRef={playerRef}
            currentCharacterIndex={currentCharacterIndex}
            map={map}
            gameId={gameId}
            isCreator={isCreator}
            gameRef={gameRef}
            setChargeProgress={setChargeProgress}
            opponentRef={opponentRef}
            realtimeDb={realtimeDb}
            playerCharacters={playerCharacters}
            opponentCharacters={opponentCharacters}
          />
          <GameEnd handleEndGame={handleEndGame} />
        </>
      )}
    </div>
  );
};

export default Game;
