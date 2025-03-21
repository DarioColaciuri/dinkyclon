import React, { useEffect, useState, useRef } from "react";
import { get, set } from "firebase/database";

const GameControls = ({
  currentTurn,
  user,
  playerRef,
  currentCharacterIndex,
  map,
}) => {
  const gravity = 0.5; // Fuerza de gravedad
  const jumpStrength = -10; // Fuerza de salto inicial
  const tileSize = 10; // Tamaño de los tiles del mapa
  const moveAmount = 5; // Cantidad de movimiento horizontal

  const [keys, setKeys] = useState({
    a: { pressed: false },
    d: { pressed: false },
    space: { pressed: false },
  });

  // Verificar colisiones
  const checkCollision = (x, y) => {
    const width = 30;
    const height = 40;

    for (let dx = 0; dx < width; dx += tileSize) {
      for (let dy = 0; dy < height; dy += tileSize) {
        const col = Math.floor((x + dx) / tileSize);
        const row = Math.floor((y + dy) / tileSize);
        const index = row * 80 + col;

        if (map[index] === 1) {
          return true;
        }
      }
    }
    return false;
  };

  // Aplicar gravedad a todos los personajes
  const applyGravity = async () => {
    const snapshot = await get(playerRef);
    const currentCharacters = snapshot.val()?.characters || [];

    const newPlayerCharacters = currentCharacters.map((character) => {
      // Si el personaje no tiene una velocidad vertical, inicializarla
      if (character.velocityY === undefined) {
        character.velocityY = 0;
      }

      let newY = character.position.y + character.velocityY; // Aplicar velocidad vertical

      // Verificar colisión debajo del personaje
      if (!checkCollision(character.position.x, newY)) {
        // Aplicar gravedad si no está en el suelo
        character.velocityY += gravity;
        return { ...character, position: { x: character.position.x, y: newY } };
      } else {
        // Detener la caída si hay colisión
        character.velocityY = 0;
        return character;
      }
    });

    await set(playerRef, { ...user, characters: newPlayerCharacters });
  };

  // Mover personaje horizontalmente y saltar
  const handleKeyDown = async (e) => {
    // Evitar el scroll de la página al presionar la barra espaciadora (globalmente)
    if (e.key === " ") {
      e.preventDefault();
    }

    if (currentTurn !== user.uid) return;

    switch (e.key.toLowerCase()) {
      case "a":
        setKeys((prev) => ({ ...prev, a: { pressed: true } }));
        break;
      case "d":
        setKeys((prev) => ({ ...prev, d: { pressed: true } }));
        break;
      case " ":
        setKeys((prev) => ({ ...prev, space: { pressed: true } }));
        break;
      default:
        break;
    }
  };

  const handleKeyUp = async (e) => {
    switch (e.key.toLowerCase()) {
      case "a":
        setKeys((prev) => ({ ...prev, a: { pressed: false } }));
        break;
      case "d":
        setKeys((prev) => ({ ...prev, d: { pressed: false } }));
        break;
      case " ":
        setKeys((prev) => ({ ...prev, space: { pressed: false } }));
        break;
      default:
        break;
    }
  };

  // Actualizar la posición del personaje en función de las teclas presionadas
  const updateCharacterPosition = async () => {
    const snapshot = await get(playerRef);
    const currentCharacters = snapshot.val()?.characters || [];

    const newPlayerCharacters = currentCharacters.map((character, index) => {
      if (index !== currentCharacterIndex) return character;

      let newX = character.position.x;

      // Movimiento horizontal fijo por frame
      if (keys.a.pressed) {
        newX -= moveAmount;
      }
      if (keys.d.pressed) {
        newX += moveAmount;
      }

      // Salto
      if (
        keys.space.pressed &&
        checkCollision(character.position.x, character.position.y + 1)
      ) {
        character.velocityY = jumpStrength;
      }

      // Verificar colisión después del movimiento horizontal
      if (!checkCollision(newX, character.position.y)) {
        return { ...character, position: { x: newX, y: character.position.y } };
      } else {
        return character; // No mover si hay colisión
      }
    });

    await set(playerRef, { ...user, characters: newPlayerCharacters });
  };

  // Escuchar eventos de teclado
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [playerRef, user, currentTurn, currentCharacterIndex]);

  // Actualizar la posición del personaje constantemente
  useEffect(() => {
    let animationFrameId;

    const update = () => {
      if (currentTurn === user.uid) {
        updateCharacterPosition();
      }
      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, [keys, currentTurn, user.uid]);

  // Aplicar gravedad constantemente
  useEffect(() => {
    const interval = setInterval(() => {
      applyGravity();
    }, 1000 / 60); // 60 FPS

    return () => clearInterval(interval);
  }, []);

  return null;
};

export default GameControls;
