import React, { useEffect, useRef, useState } from "react";
import { ref, onValue, set, remove } from "firebase/database";
import { realtimeDb } from "../firebase/firebase";
import { useLocation, useNavigate } from "react-router-dom";
import "../css/Game.css";

const Game = () => {
  const canvasRef = useRef(null); // Referencia al elemento <canvas>
  const navigate = useNavigate();
  const location = useLocation();
  const { gameId, user, opponent, isCreator } = location.state || {}; // Obtener gameId, user, opponent y isCreator del estado de la navegación

  const [playerPosition, setPlayerPosition] = useState({ x: 100, y: 100 });
  const [opponentPosition, setOpponentPosition] = useState(null); // Inicialmente null
  const [waitingForOpponent, setWaitingForOpponent] = useState(true); // Estado de espera

  // Referencias a las posiciones en Realtime Database
  const gameRef = ref(realtimeDb, `games/${gameId}`);
  const playerRef = ref(
    realtimeDb,
    `games/${gameId}/player${isCreator ? "1" : "2"}`
  ); // Jugador 1 o 2 según sea el creador
  const opponentRef = ref(
    realtimeDb,
    `games/${gameId}/player${isCreator ? "2" : "1"}`
  ); // Oponente

  // Referencia para notificar la finalización de la partida
  const gameEndRef = ref(realtimeDb, `games/${gameId}/status`);

  // Registrar la conexión del jugador
  useEffect(() => {
    if (user?.uid) {
      const playerConnectionRef = ref(
        realtimeDb,
        `games/${gameId}/player${isCreator ? "1" : "2"}/connected`
      );
      set(playerConnectionRef, true); // Registrar que el jugador está conectado

      // Escuchar cambios en la posición del oponente
      const opponentPositionListener = onValue(opponentRef, (snapshot) => {
        if (snapshot.exists()) {
          setOpponentPosition(snapshot.val().position);
        } else {
          // Si el oponente abandona la partida, limpiar su posición
          setOpponentPosition(null);
        }
      });

      // Escuchar notificaciones de finalización de partida
      const gameEndListener = onValue(gameEndRef, (snapshot) => {
        if (snapshot.exists() && snapshot.val() === "ended") {
          alert("El oponente ha abandonado la partida.");
          handleEndGame(); // Finalizar la partida para este jugador
        }
      });

      // Limpiar el estado de conexión al desmontar el componente
      return () => {
        set(playerConnectionRef, false); // Registrar que el jugador se desconectó
        opponentPositionListener(); // Detener el listener del oponente
        gameEndListener(); // Detener el listener de finalización de partida
      };
    }
  }, [gameId, user?.uid, opponentRef, gameEndRef, isCreator]);

  // Esperar a que el oponente se conecte
  useEffect(() => {
    if (opponentRef) {
      const timeout = setTimeout(() => {
        alert("El oponente no se ha conectado a tiempo.");
        handleEndGame(); // Finalizar la partida si el oponente no se conecta
      }, 10000); // 10 segundos de espera

      const opponentConnectionRef = ref(
        realtimeDb,
        `games/${gameId}/player${isCreator ? "2" : "1"}/connected`
      );
      const opponentConnectionListener = onValue(
        opponentConnectionRef,
        (snapshot) => {
          if (snapshot.exists() && snapshot.val() === true) {
            clearTimeout(timeout); // Limpiar el timeout
            setWaitingForOpponent(false); // Ocultar la pantalla de espera
          }
        }
      );

      return () => {
        clearTimeout(timeout); // Limpiar el timeout al desmontar
        opponentConnectionListener(); // Detener el listener del oponente
      };
    }
  }, [gameId, opponentRef, isCreator]);

  // Mover al jugador con las teclas A, W, S, D
  useEffect(() => {
    const handleKeyDown = (e) => {
      const { x, y } = playerPosition;
      let newX = x;
      let newY = y;

      switch (e.key.toLowerCase()) {
        case "a":
          newX = x - 10; // Izquierda
          break;
        case "d":
          newX = x + 10; // Derecha
          break;
        case "w":
          newY = y - 10; // Arriba
          break;
        case "s":
          newY = y + 10; // Abajo
          break;
        default:
          break;
      }

      // Actualizar la posición en Realtime Database
      if (playerRef) {
        set(playerRef, { ...user, position: { x: newX, y: newY } });
        setPlayerPosition({ x: newX, y: newY });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playerPosition, playerRef, user]);

  // Dibujar el canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return; // Asegurarse de que el canvas esté disponible

    const ctx = canvas.getContext("2d");
    let animationFrameId;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Dibujar el punto del jugador
      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.arc(playerPosition.x, playerPosition.y, 10, 0, Math.PI * 2);
      ctx.fill();

      // Dibujar el punto del oponente solo si opponentPosition está definido
      if (opponentPosition) {
        ctx.fillStyle = "blue";
        ctx.beginPath();
        ctx.arc(opponentPosition.x, opponentPosition.y, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    // Limpiar la animación al desmontar el componente
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [playerPosition, opponentPosition]);

  // Finalizar la partida para ambos jugadores
  const handleEndGame = async () => {
    // Notificar que la partida ha finalizado
    await set(gameEndRef, "ended");

    // Eliminar la partida de la base de datos
    await remove(gameRef);

    // Limpiar el estado de matchmaking para ambos jugadores
    const playerMatchmakingRef = ref(realtimeDb, `matchmaking/${user.uid}`);
    const opponentMatchmakingRef = ref(
      realtimeDb,
      `matchmaking/${opponent.uid}`
    );
    await remove(playerMatchmakingRef);
    await remove(opponentMatchmakingRef);

    // Limpiar el estado del oponente
    setOpponentPosition(null);

    navigate("/lobby"); // Redirigir al lobby
  };

  return (
    <div className="game-container">
      {waitingForOpponent ? (
        <p>Esperando al oponente...</p>
      ) : (
        <>
          <h2>Partida en curso</h2>
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
