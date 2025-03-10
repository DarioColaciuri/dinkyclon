import React, { useEffect, useRef, useState } from "react";
import { ref, onValue, set, remove } from "firebase/database";
import { realtimeDb } from "../firebase/firebase";
import { useLocation, useNavigate } from "react-router-dom";
import "../css/Game.css";

const Game = () => {
  const canvasRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, opponent } = location.state || {}; // Obtener user y opponent del estado de la navegación

  const [playerPosition, setPlayerPosition] = useState({ x: 100, y: 100 });
  const [opponentPosition, setOpponentPosition] = useState({ x: 300, y: 100 });
  const [waitingForOpponent, setWaitingForOpponent] = useState(true); // Estado de espera

  // Referencias a las posiciones en Realtime Database
  const playerRef = ref(realtimeDb, `games/${user?.uid}/position`);
  const opponentRef = ref(realtimeDb, `games/${opponent?.uid}/position`);

  // Referencia para notificar la finalización de la partida
  const gameEndRef = ref(realtimeDb, `games/${user?.uid}/gameEnded`);

  // Registrar la conexión del jugador
  useEffect(() => {
    if (user?.uid) {
      const playerConnectionRef = ref(
        realtimeDb,
        `games/${user.uid}/connected`
      );
      set(playerConnectionRef, true); // Registrar que el jugador está conectado

      // Escuchar cambios en la posición del oponente
      const opponentPositionListener = onValue(opponentRef, (snapshot) => {
        if (snapshot.exists()) {
          setOpponentPosition(snapshot.val());
        }
      });

      // Escuchar notificaciones de finalización de partida
      const gameEndListener = onValue(gameEndRef, (snapshot) => {
        if (snapshot.exists() && snapshot.val() === true) {
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
  }, [user?.uid, opponentRef, gameEndRef]);

  // Esperar a que el oponente se conecte
  useEffect(() => {
    if (opponentRef) {
      const timeout = setTimeout(() => {
        alert("El oponente no se ha conectado a tiempo.");
        handleEndGame(); // Finalizar la partida si el oponente no se conecta
      }, 10000); // 10 segundos de espera

      const opponentConnectionRef = ref(
        realtimeDb,
        `games/${opponent?.uid}/connected`
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
  }, [opponentRef, opponent?.uid]);

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
        set(playerRef, { x: newX, y: newY });
        setPlayerPosition({ x: newX, y: newY });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playerPosition, playerRef]);

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

      // Dibujar el punto del oponente
      ctx.fillStyle = "blue";
      ctx.beginPath();
      ctx.arc(opponentPosition.x, opponentPosition.y, 10, 0, Math.PI * 2);
      ctx.fill();

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
    // Notificar al oponente que la partida ha finalizado
    const opponentGameEndRef = ref(
      realtimeDb,
      `games/${opponent.uid}/gameEnded`
    );
    await set(opponentGameEndRef, true); // Notificar al oponente

    // Eliminar la partida de la base de datos para ambos jugadores
    const playerGameRef = ref(realtimeDb, `games/${user.uid}`);
    const opponentGameRef = ref(realtimeDb, `games/${opponent.uid}`);

    await remove(playerGameRef); // Eliminar datos del jugador
    await remove(opponentGameRef); // Eliminar datos del oponente

    // Limpiar el estado de matchmaking para ambos jugadores
    const playerMatchmakingRef = ref(realtimeDb, `matchmaking/${user.uid}`);
    const opponentMatchmakingRef = ref(
      realtimeDb,
      `matchmaking/${opponent.uid}`
    );
    await remove(playerMatchmakingRef);
    await remove(opponentMatchmakingRef);

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
