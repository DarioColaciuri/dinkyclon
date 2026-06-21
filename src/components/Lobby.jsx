import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase/supabase";
import { useNavigate } from "react-router-dom";
import "../css/Lobby.css";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3001";

const Lobby = ({ user, userData }) => {
  const [searching, setSearching] = useState(false);
  const [matchFound, setMatchFound] = useState(false);
  const [opponent, setOpponent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [searchCounter, setSearchCounter] = useState(0);
  const [hasAccepted, setHasAccepted] = useState(false);
  const [localElo, setLocalElo] = useState(userData?.elo || 500);
  const navigate = useNavigate();
  const wsRef = useRef(null);

  useEffect(() => {
    if (!user) {
      navigate("/");
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user) {
      supabase
        .from("profiles")
        .select("elo")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) setLocalElo(data.elo);
        });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const elo = localElo;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "auth_data",
          uid: user.id,
          nickname: userData?.nickname || user.email,
          elo,
        })
      );
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "match_status":
          if (msg.status === "searching") {
            setSearching(true);
            setSearchCounter(0);
          } else if (msg.status === "cancelled") {
            setSearching(false);
            setMatchFound(false);
            setShowModal(false);
            setHasAccepted(false);
          }
          break;

        case "match_found":
          setMatchFound(true);
          setOpponent(msg.opponent);
          setShowModal(true);
          setCountdown(10);
          setHasAccepted(false);
          break;

        case "match_cancelled":
          setMatchFound(false);
          setOpponent(null);
          setShowModal(false);
          setSearching(false);
          setHasAccepted(false);
          alert(
            msg.reason === "rejected"
              ? "Partida rechazada."
              : msg.reason === "timeout"
                ? "Tiempo de aceptacion expirado."
                : "El oponente cancelo la busqueda."
          );
          break;

        case "game_start":
          navigate("/game", {
            state: {
              gameId: msg.gameId,
              user: { uid: user.id, email: user.email },
              opponent: msg.opponent,
              isCreator: msg.isCreator,
            },
          });
          break;
      }
    };

    return () => {
      ws.close();
    };
  }, [user, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleSearchGame = () => {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(
      JSON.stringify({ type: "matchmaking", action: "search" })
    );
  };

  const handleCancelSearch = () => {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(
      JSON.stringify({ type: "matchmaking", action: "cancel" })
    );
    setSearching(false);
    setMatchFound(false);
    setShowModal(false);
  };

  const handleAcceptMatch = () => {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    if (hasAccepted) return;
    setHasAccepted(true);
    wsRef.current.send(
      JSON.stringify({ type: "match_response", action: "accept" })
    );
  };

  const handleRejectMatch = () => {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(
      JSON.stringify({ type: "match_response", action: "reject" })
    );
    setMatchFound(false);
    setOpponent(null);
    setShowModal(false);
    setSearching(false);
  };

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
          if (prev <= 1) {
            handleRejectMatch();
            alert("El tiempo para aceptar la partida ha expirado.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [matchFound, showModal]);

  if (!user) {
    return null;
  }

  return (
    <div className="lobby-container">
      <h2>Bienvenido, {userData?.nickname || user.email}</h2>
      <p>ELO: {localElo}</p>

      {!searching && !matchFound && (
        <button onClick={handleSearchGame}>Buscar partida</button>
      )}

      {searching && !matchFound && (
        <>
          <p>Buscando partida... {searchCounter}s</p>
          <button onClick={handleCancelSearch}>Cancelar busqueda</button>
        </>
      )}

      {showModal && opponent && (
        <div className="modal-overlay">
          <div className="modal">
            <p>
              Oponente encontrado: {opponent.nickname} ({opponent.elo} ELO)
            </p>
            <p>Tiempo restante: {countdown} segundos</p>
            {hasAccepted ? (
              <p className="waiting-text">Esperando al oponente...</p>
            ) : (
              <>
                <button onClick={handleAcceptMatch}>Aceptar</button>
                <button onClick={handleRejectMatch}>Rechazar</button>
              </>
            )}
          </div>
        </div>
      )}

      <button onClick={handleLogout} className="logout-button">
        Cerrar sesion
      </button>
    </div>
  );
};

export default Lobby;
