import React, { useEffect, useRef, useState } from "react";
import { ref, onValue, set, remove, get } from "firebase/database";
import { realtimeDb } from "../firebase/firebase";
import { useLocation, useNavigate } from "react-router-dom";
import "../css/Game.css";
import Level2 from "./levels/Level2"; // Importar el componente del mapa

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
  const [backgroundImage, setBackgroundImage] = useState(null); // Estado para la imagen de fondo

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

  // Obtener el mapa del nivel 2
  const map = Level2();

  // Cargar la imagen de fondo según el nivel
  useEffect(() => {
    const level = 2; // Cambia esto según el nivel actual
    const image = new Image();
    image.src = `/back${level}.webp`; // Ruta a la imagen en la carpeta public

    image.onload = () => {
      setBackgroundImage(image); // Guardar la imagen cargada en el estado
    };

    image.onerror = () => {
      console.warn(
        `No se pudo cargar la imagen de fondo para el nivel ${level}.`
      );
      setBackgroundImage(null); // No hacer nada si la imagen no se encuentra
    };
  }, []);

  // Función para verificar colisiones
  const checkCollision = (x, y) => {
    // Convertir coordenadas a índices del mapa
    const col = Math.floor(x / 10);
    const row = Math.floor(y / 10);
    const index = row * 80 + col; // Calcular el índice en el array unidimensional

    // Verificar si el tile es 1 (colisión)
    return map[index] === 1;
  };

  // Efecto para sincronizar el turno actual, el índice del personaje y el contador
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

    const countdownListener = onValue(countdownRef, (snapshot) => {
      if (snapshot.exists()) {
        setCountdown(snapshot.val());
      }
    });

    return () => {
      currentTurnListener();
      currentCharacterIndexListener();
      countdownListener();
    };
  }, []);

  // Efecto para manejar el contador de turnos
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
      if (currentTurn !== user.uid) return;

      const moveAmount = 10;
      const snapshot = await get(playerRef);
      const currentCharacters = snapshot.val()?.characters || [];

      const newPlayerCharacters = currentCharacters.map((character, index) => {
        if (index !== currentCharacterIndex) return character;

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

        // Verificar colisión antes de mover al personaje
        if (!checkCollision(newX, newY)) {
          return { ...character, position: { x: newX, y: newY } };
        } else {
          return character; // No mover si hay colisión
        }
      });

      await set(playerRef, { ...user, characters: newPlayerCharacters });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playerRef, user, currentTurn, currentCharacterIndex]);

  // Efecto para dibujar el mapa y los personajes en el canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animationFrameId;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Dibujar la imagen de fondo si está cargada
      if (backgroundImage) {
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
      }

      // Dibujar el mapa
      map.forEach((tile, index) => {
        if (tile === 1) {
          const col = index % 80; // Columna actual
          const row = Math.floor(index / 80); // Fila actual
          ctx.fillStyle = "rgba(255, 255, 0, 0.267)"; // Color de los tiles
          ctx.fillRect(col * 10, row * 10, 10, 10); // Dibujar tile de 10x10
        }
      });

      // Dibujar los personajes del jugador
      playerCharacters.forEach(({ position }, index) => {
        ctx.fillStyle = index === currentCharacterIndex ? "darkred" : "red";
        ctx.fillRect(position.x, position.y, 10, 10); // Dibujar personaje de 10x10
      });

      // Dibujar los personajes del oponente
      opponentCharacters.forEach(({ position }, index) => {
        ctx.fillStyle = index === currentCharacterIndex ? "darkblue" : "blue";
        ctx.fillRect(position.x, position.y, 10, 10); // Dibujar personaje de 10x10
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    playerCharacters,
    opponentCharacters,
    currentCharacterIndex,
    map,
    backgroundImage,
  ]);

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
