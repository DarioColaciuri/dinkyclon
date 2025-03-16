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
  const [searching, setSearching] = useState(false); // Estado de búsqueda
  const [matchFound, setMatchFound] = useState(false); // Estado de partida encontrada
  const [opponent, setOpponent] = useState(null); // Información del oponente
  const [timeoutId, setTimeoutId] = useState(null); // ID del timeout
  const [showModal, setShowModal] = useState(false); // Controlar visibilidad del modal
  const [countdown, setCountdown] = useState(10); // Cuenta regresiva de 10 segundos
  const navigate = useNavigate();

  // Redirigir si el usuario no está autenticado
  useEffect(() => {
    if (!user) {
      navigate("/"); // Redirigir a la página de autenticación
    }
  }, [user, navigate]);

  // Cerrar sesión
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/"); // Redirigir a la página de autenticación
  };

  // Buscar partida
  const handleSearchGame = async () => {
    setSearching(true);

    // Registrar al jugador en la búsqueda de partida
    const matchmakingRef = ref(realtimeDb, `matchmaking/${user.uid}`);
    await set(matchmakingRef, {
      uid: user.uid,
      nickname: userData.nickname,
      elo: userData.elo,
      status: "searching", // Estado inicial
    });

    // Escuchar cambios en el estado de emparejamiento
    const matchmakingListener = onValue(matchmakingRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.status === "found") {
        // Partida encontrada
        setMatchFound(true);
        setOpponent(data.opponent); // Guardar información del oponente
        setShowModal(true); // Mostrar el modal
      } else if (data && data.status === "rejected") {
        // El oponente rechazó la partida
        resetMatchmaking();
        alert("Partida rechazada.");
      }
    });

    // Tiempo de espera de 10 segundos
    const id = setTimeout(() => {
      if (!matchFound) {
        resetMatchmaking();
        alert("No se encontró un oponente disponible.");
      }
    }, 10000);
    setTimeoutId(id);

    // Limpiar el listener al desmontar el componente
    return () => {
      matchmakingListener(); // Detener el listener
    };
  };

  // Aceptar partida
  const handleAcceptMatch = async () => {
    const matchmakingRef = ref(realtimeDb, `matchmaking/${user.uid}`);
    await set(matchmakingRef, {
      ...opponent,
      status: "accepted", // Cambiar estado a "accepted"
    });

    // Generar un gameId consistente ordenando los uid
    const gameId = [user.uid, opponent.uid].sort().join("_");
    const gameRef = ref(realtimeDb, `games/${gameId}`);

    // Usar una transacción para crear la partida de manera atómica
    try {
      await runTransaction(gameRef, (currentData) => {
        if (currentData === null) {
          // Si la partida no existe, crearla
          return {
            player1: {
              uid: user.uid,
              nickname: userData.nickname,
              elo: userData.elo,
              characters: [
                { position: { x: 100, y: 100 }, life: 100 }, // Personaje 1
                { position: { x: 100, y: 200 }, life: 100 }, // Personaje 2
                { position: { x: 100, y: 300 }, life: 100 }, // Personaje 3
              ],
              connected: true, // Registrar que el jugador está conectado
            },
            player2: {
              uid: opponent.uid,
              nickname: opponent.nickname,
              elo: opponent.elo,
              characters: [
                { position: { x: 700, y: 100 }, life: 100 }, // Personaje 1
                { position: { x: 700, y: 200 }, life: 100 }, // Personaje 2
                { position: { x: 700, y: 300 }, life: 100 }, // Personaje 3
              ],
              connected: false, // El oponente aún no está conectado
            },
            status: "in_progress", // Estado de la partida
            currentTurn: user.uid, // El creador de la partida empieza primero
            currentCharacterIndex: 0, // Empieza con el primer personaje
          };
        } else {
          // Si la partida ya existe, no hacer nada
          return currentData;
        }
      });

      console.log("Redirigiendo a la partida...");
      navigate("/game", {
        state: {
          gameId, // Pasar el ID de la partida
          user: {
            uid: user.uid,
            email: user.email,
          },
          opponent: {
            uid: opponent.uid,
            nickname: opponent.nickname,
            elo: opponent.elo,
          },
          isCreator: user.uid < opponent.uid, // Indicar si este jugador es el creador de la partida
        },
      });
    } catch (error) {
      console.error("Error al crear la partida:", error);
      alert("Hubo un error al crear la partida. Inténtalo de nuevo.");
    }
  };

  // Rechazar partida
  const handleRejectMatch = async () => {
    const matchmakingRef = ref(realtimeDb, `matchmaking/${user.uid}`);
    await set(matchmakingRef, {
      ...opponent,
      status: "rejected", // Cambiar estado a "rejected"
    });

    resetMatchmaking();
    setShowModal(false); // Ocultar el modal
  };

  // Limpiar estados y eliminar de la búsqueda
  const resetMatchmaking = () => {
    setSearching(false);
    setMatchFound(false);
    setOpponent(null);
    const matchmakingRef = ref(realtimeDb, `matchmaking/${user.uid}`);
    remove(matchmakingRef); // Eliminar de la búsqueda
  };

  // Limpiar el timeout al desmontar el componente
  useEffect(() => {
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [timeoutId]);

  // Cuenta regresiva en la pantalla de espera
  useEffect(() => {
    if (searching && matchFound && showModal) {
      const interval = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);

      return () => clearInterval(interval); // Limpiar el intervalo al desmontar
    }
  }, [searching, matchFound, showModal]);

  // Emparejar jugadores
  useEffect(() => {
    const matchmakingRef = ref(realtimeDb, "matchmaking");

    // Escuchar cambios en la lista de búsqueda
    const matchmakingListener = onValue(matchmakingRef, (snapshot) => {
      const matchmakingData = snapshot.val();
      if (matchmakingData) {
        const players = Object.values(matchmakingData);
        const searchingPlayers = players.filter(
          (p) => p.status === "searching"
        );

        if (searchingPlayers.length >= 2) {
          // Emparejar a los dos primeros jugadores
          const [player1, player2] = searchingPlayers;

          const player1Ref = ref(realtimeDb, `matchmaking/${player1.uid}`);
          const player2Ref = ref(realtimeDb, `matchmaking/${player2.uid}`);

          set(player1Ref, {
            ...player1,
            status: "found", // Cambiar estado a "found"
            opponent: player2, // Guardar información del oponente
          });

          set(player2Ref, {
            ...player2,
            status: "found", // Cambiar estado a "found"
            opponent: player1, // Guardar información del oponente
          });
        }
      }
    });

    // Limpiar el listener al desmontar el componente
    return () => {
      matchmakingListener(); // Detener el listener
    };
  }, []);

  // Si el usuario no está autenticado, no renderizar el componente
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

      {searching && !matchFound && <p>Buscando partida...</p>}

      {/* Modal para "Oponente encontrado" */}
      {showModal && opponent && (
        <div className="modal-overlay">
          <div className="modal">
            <p>Oponente encontrado:</p>
            <p>Nickname: {opponent.nickname}</p>
            <p>ELO: {opponent.elo}</p>
            <p>Tiempo restante: {countdown} segundos</p>
            <button onClick={handleAcceptMatch}>Aceptar partida</button>
            <button onClick={handleRejectMatch}>Rechazar partida</button>
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
