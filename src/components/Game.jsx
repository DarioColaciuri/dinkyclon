import React, { useEffect, useRef, useState } from "react";
import { ref, onValue, set, remove, get } from "firebase/database";
import { realtimeDb } from "../firebase/firebase";
import { useLocation, useNavigate } from "react-router-dom";
import "../css/Game.css";

const Game = () => {
  const canvasRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { gameId, user, opponent, isCreator } = location.state || {};

  const [playerCharacters, setPlayerCharacters] = useState([]);
  const [opponentCharacters, setOpponentCharacters] = useState([]);
  const [waitingForOpponent, setWaitingForOpponent] = useState(true);
  const [currentTurn, setCurrentTurn] = useState(null); // Turno actual (player1 o player2)
  const [countdown, setCountdown] = useState(30); // Contador de 30 segundos
  const [currentCharacterIndex, setCurrentCharacterIndex] = useState(0); // Índice del personaje actual (0, 1, 2)

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

  // Efecto para sincronizar el turno actual y el índice del personaje
  useEffect(() => {
    const currentTurnListener = onValue(currentTurnRef, (snapshot) => {
      if (snapshot.exists()) {
        setCurrentTurn(snapshot.val());
      }
    });

    const currentCharacterIndexListener = onValue(
      currentCharacterIndexRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setCurrentCharacterIndex(snapshot.val());
        }
      }
    );

    return () => {
      currentTurnListener();
      currentCharacterIndexListener();
    };
  }, []);

  // Efecto para manejar el contador de turnos
  useEffect(() => {
    if (currentTurn) {
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === 0) {
            // Cambiar de turno y reiniciar el contador
            const nextTurn = currentTurn === user.uid ? opponent.uid : user.uid;
            const nextCharacterIndex = (currentCharacterIndex + 1) % 3; // Ciclar entre 0, 1, 2
            set(currentTurnRef, nextTurn);
            set(currentCharacterIndexRef, nextCharacterIndex);
            setCountdown(30);
            return 30;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [currentTurn, currentCharacterIndex, user.uid, opponent.uid]);

  // Efecto para sincronizar los personajes del jugador y el oponente
  useEffect(() => {
    if (user?.uid) {
      set(playerConnectionRef, true);

      const playerCharactersListener = onValue(playerRef, (snapshot) => {
        if (snapshot.exists()) {
          setPlayerCharacters(snapshot.val().characters || []);
        }
      });

      const opponentCharactersListener = onValue(opponentRef, (snapshot) => {
        if (snapshot.exists()) {
          setOpponentCharacters(snapshot.val().characters || []);
        } else {
          setOpponentCharacters([]);
        }
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

  // Efecto para manejar la conexión del oponente
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

  // Efecto para manejar el movimiento de los personajes
  useEffect(() => {
    const handleKeyDown = async (e) => {
      // Solo permitir movimiento si es el turno del jugador
      if (currentTurn !== user.uid) return;

      const moveAmount = 10;
      const snapshot = await get(playerRef);
      const currentCharacters = snapshot.val()?.characters || [];

      const newPlayerCharacters = currentCharacters.map((character, index) => {
        if (index !== currentCharacterIndex) return character; // Solo mover el personaje actual

        let newX = character.position.x;
        let newY = character.position.y;

        switch (e.key.toLowerCase()) {
          case "a":
            newX -= moveAmount;
            break;
          case "d":
            newX += moveAmount;
            break;
          case "w":
            newY -= moveAmount;
            break;
          case "s":
            newY += moveAmount;
            break;
          default:
            break;
        }

        return { ...character, position: { x: newX, y: newY } };
      });

      await set(playerRef, { ...user, characters: newPlayerCharacters });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playerRef, user, currentTurn, currentCharacterIndex]);

  // Efecto para dibujar los personajes en el canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animationFrameId;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      playerCharacters.forEach(({ position }, index) => {
        ctx.fillStyle = index === currentCharacterIndex ? "darkred" : "red"; // Resaltar el personaje actual
        ctx.beginPath();
        ctx.arc(position.x, position.y, 10, 0, Math.PI * 2);
        ctx.fill();
      });
      opponentCharacters.forEach(({ position }, index) => {
        ctx.fillStyle = index === currentCharacterIndex ? "darkblue" : "blue"; // Resaltar el personaje actual
        ctx.beginPath();
        ctx.arc(position.x, position.y, 10, 0, Math.PI * 2);
        ctx.fill();
      });
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationFrameId);
  }, [playerCharacters, opponentCharacters, currentCharacterIndex]);

  // Función para terminar la partida
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
          <h2>Partida en curso</h2>
          <div className="turn-info">
            <p>
              Turno de:{" "}
              {currentTurn === user.uid ? user.nickname : opponent.nickname} (
              {countdown}s)
            </p>
            <p>Personaje actual: {currentCharacterIndex + 1}</p>
          </div>
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="game-canvas"
          />
          <button onClick={handleEndGame} className="back-button">
            Volver al lobby
          </button>
        </>
      )}
    </div>
  );
};

export default Game;
