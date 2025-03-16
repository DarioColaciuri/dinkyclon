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

  useEffect(() => {
    const handleKeyDown = async (e) => {
      const moveAmount = 10;
      const snapshot = await get(playerRef);
      const currentCharacters = snapshot.val()?.characters || [];

      const newPlayerCharacters = currentCharacters.map((character) => {
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
  }, [playerRef, user]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animationFrameId;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      playerCharacters.forEach(({ position }) => {
        ctx.fillStyle = "red";
        ctx.beginPath();
        ctx.arc(position.x, position.y, 10, 0, Math.PI * 2);
        ctx.fill();
      });
      opponentCharacters.forEach(({ position }) => {
        ctx.fillStyle = "blue";
        ctx.beginPath();
        ctx.arc(position.x, position.y, 10, 0, Math.PI * 2);
        ctx.fill();
      });
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationFrameId);
  }, [playerCharacters, opponentCharacters]);

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
