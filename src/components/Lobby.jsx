import React, { useState, useEffect } from "react";
import { getAuth, signOut } from "firebase/auth";
import {
  ref,
  set,
  onValue,
  remove,
  get,
  runTransaction,
} from "firebase/database";
import { auth, realtimeDb } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";
import "../css/Lobby.css";

const Lobby = ({ user, userData }) => {
  const [searching, setSearching] = useState(false);
  const [matchFound, setMatchFound] = useState(false);
  const [opponent, setOpponent] = useState(null);
  const [timeoutId, setTimeoutId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [searchCounter, setSearchCounter] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const handleSearchGame = async () => {
    setSearching(true);
    setSearchCounter(0);

    const matchmakingRef = ref(realtimeDb, `matchmaking/${user.uid}`);
    await set(matchmakingRef, {
      uid: user.uid,
      nickname: userData.nickname,
      elo: userData.elo,
      status: "searching",
    });

    const matchmakingListener = onValue(matchmakingRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.status === "found") {
        setMatchFound(true);
        setOpponent(data.opponent);
        setShowModal(true);
        setSearchCounter(0); // Detener el contador de búsqueda
        setCountdown(10); // Reiniciar cuenta regresiva
      } else if (data && data.status === "rejected") {
        resetMatchmaking();
        alert("Partida rechazada.");
      }
    });

    const id = setTimeout(() => {
      if (!matchFound) {
        resetMatchmaking();
        alert("No se encontró un oponente disponible.");
      }
    }, 10000);
    setTimeoutId(id);

    return () => {
      matchmakingListener();
    };
  };

  const handleCancelSearch = () => {
    resetMatchmaking();
    alert("Búsqueda de partida cancelada.");
  };

  const handleAcceptMatch = async () => {
    const matchmakingRef = ref(realtimeDb, `matchmaking/${user.uid}`);
    await set(matchmakingRef, {
      ...opponent,
      status: "accepted",
    });

    const gameId = [user.uid, opponent.uid].sort().join("_");
    const gameRef = ref(realtimeDb, `games/${gameId}`);

    try {
      await runTransaction(gameRef, (currentData) => {
        if (currentData === null) {
          return {
            player1: {
              uid: user.uid,
              nickname: userData.nickname,
              elo: userData.elo,
              characters: [
                { position: { x: 100, y: 100 }, life: 100 },
                { position: { x: 110, y: 200 }, life: 100 },
                { position: { x: 120, y: 300 }, life: 100 },
              ],
              connected: true,
            },
            player2: {
              uid: opponent.uid,
              nickname: opponent.nickname,
              elo: opponent.elo,
              characters: [
                { position: { x: 700, y: 100 }, life: 100 },
                { position: { x: 690, y: 200 }, life: 100 },
                { position: { x: 680, y: 300 }, life: 100 },
              ],
              connected: false,
            },
            status: "in_progress",
            currentTurn: user.uid,
            currentCharacterIndex: 0,
            countdown: 30, // Inicializar el temporizador en 30 segundos
          };
        } else {
          return currentData;
        }
      });

      navigate("/game", {
        state: {
          gameId,
          user: {
            uid: user.uid,
            email: user.email,
          },
          opponent: {
            uid: opponent.uid,
            nickname: opponent.nickname,
            elo: opponent.elo,
          },
          isCreator: user.uid < opponent.uid,
        },
      });
    } catch (error) {
      console.error("Error al crear la partida:", error);
      alert("Hubo un error al crear la partida. Inténtalo de nuevo.");
    }
  };

  const handleRejectMatch = async () => {
    const matchmakingRef = ref(realtimeDb, `matchmaking/${user.uid}`);
    await set(matchmakingRef, {
      ...opponent,
      status: "rejected",
    });

    resetMatchmaking();
    setShowModal(false);
  };

  const resetMatchmaking = () => {
    setSearching(false);
    setMatchFound(false);
    setOpponent(null);
    setSearchCounter(0);
    setCountdown(10);
    const matchmakingRef = ref(realtimeDb, `matchmaking/${user.uid}`);
    remove(matchmakingRef);
  };

  useEffect(() => {
    if (timeoutId) clearTimeout(timeoutId);
  }, [timeoutId]);

  useEffect(() => {
    if (searching && !matchFound) {
      const interval = setInterval(() => {
        setSearchCounter((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [searching, matchFound]);

  useEffect(() => {
    if (matchFound && showModal) {
      setCountdown(10);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === 1) {
            alert("El tiempo para aceptar la partida ha expirado.");
            resetMatchmaking();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [matchFound, showModal]);

  useEffect(() => {
    const matchmakingRef = ref(realtimeDb, "matchmaking");

    const matchmakingListener = onValue(matchmakingRef, (snapshot) => {
      const matchmakingData = snapshot.val();
      if (matchmakingData) {
        const players = Object.values(matchmakingData);
        const searchingPlayers = players.filter(
          (p) => p.status === "searching"
        );

        if (searchingPlayers.length >= 2) {
          const [player1, player2] = searchingPlayers;

          const player1Ref = ref(realtimeDb, `matchmaking/${player1.uid}`);
          const player2Ref = ref(realtimeDb, `matchmaking/${player2.uid}`);

          set(player1Ref, {
            ...player1,
            status: "found",
            opponent: player2,
          });

          set(player2Ref, {
            ...player2,
            status: "found",
            opponent: player1,
          });
        }
      }
    });

    return () => {
      matchmakingListener();
    };
  }, []);

  if (!user) {
    return null;
  }

  return (
    <div className="lobby-container">
      <h2>Bienvenido, {userData?.nickname || user.email}</h2>
      <p>ELO: {userData?.elo || 500}</p>

      {!searching && !matchFound && (
        <button onClick={handleSearchGame}>Buscar partida</button>
      )}

      {searching && !matchFound && (
        <>
          <p>Buscando partida... {searchCounter}s</p>
          <button onClick={handleCancelSearch}>Cancelar búsqueda</button>
        </>
      )}

      {showModal && opponent && (
        <div className="modal-overlay">
          <div className="modal">
            <p>
              Oponente encontrado: {opponent.nickname} ({opponent.elo} ELO)
            </p>
            <p>Tiempo restante: {countdown} segundos</p>
            <button onClick={handleAcceptMatch}>Aceptar</button>
            <button onClick={handleRejectMatch}>Rechazar</button>
          </div>
        </div>
      )}

      <button onClick={handleLogout} className="logout-button">
        Cerrar sesión
      </button>
    </div>
  );
};

export default Lobby;
