import React, { useEffect, useState, useRef } from "react";
import { get, set, ref, push } from "firebase/database";

const GameControls = ({
  currentTurn,
  user,
  playerRef,
  currentCharacterIndex,
  map,
  isCreator,
  gameId,
  realtimeDb,
  setChargeProgress,
  playerCharacters,
  opponentCharacters,
}) => {
  const gravity = 0.5;
  const jumpStrength = -10;
  const tileSize = 10;
  const moveAmount = 5;
  const baseProjectileSpeed = 5;
  const maxProjectileSpeed = 20;
  const maxChargeTime = 1000;

  const [keys, setKeys] = useState({
    a: { pressed: false },
    d: { pressed: false },
    space: { pressed: false },
    control: { pressed: false },
    w: { pressed: false },
    s: { pressed: false },
  });

  const chargeStartTime = useRef(null);
  const isCharging = useRef(false);
  const chargeInterval = useRef(null);

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

  const checkProjectileCollision = (x, y) => {
    const width = 10;
    const height = 10;

    for (let dx = 0; dx < width; dx++) {
      for (let dy = 0; dy < height; dy++) {
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

  const checkCharacterCollision = (projectile, character) => {
    return (
      projectile.x >= character.position.x &&
      projectile.x <= character.position.x + 30 &&
      projectile.y >= character.position.y &&
      projectile.y <= character.position.y + 40
    );
  };

  const applyGravity = async () => {
    const snapshot = await get(playerRef);
    const currentCharacters = snapshot.val()?.characters || [];

    const updatedCharacters = currentCharacters.map((character) => {
      if (character.velocityY === undefined) {
        character.velocityY = 0;
      }

      let newY = character.position.y + character.velocityY;

      if (!checkCollision(character.position.x, newY)) {
        character.velocityY += gravity;
        character.position.y = newY;
      } else {
        character.velocityY = 0;
      }

      return character;
    });

    await set(playerRef, { ...snapshot.val(), characters: updatedCharacters });
  };

  const registerHit = async ({
    target,
    characterIndex,
    amount,
    isAlly = false,
  }) => {
    try {
      console.log(`Registrando daño a ${target}-${characterIndex}`, {
        cantidad: amount,
        esAliado: isAlly,
      });

      const damageRef = ref(realtimeDb, `games/${gameId}/damageQueue`);
      await push(damageRef, {
        target,
        characterIndex,
        amount,
        isAlly,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Error al registrar daño:", error);
    }
  };

  const handleKeyDown = async (e) => {
    if (e.key === " ") e.preventDefault();
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
      case "control":
        if (!isCharging.current) {
          isCharging.current = true;
          chargeStartTime.current = Date.now();
          chargeInterval.current = setInterval(() => {
            const chargeTime = Date.now() - chargeStartTime.current;
            const progress = Math.min(chargeTime / maxChargeTime, 1);
            setChargeProgress(progress);
          }, 50);
        }
        setKeys((prev) => ({ ...prev, control: { pressed: true } }));
        break;
      case "w":
        setKeys((prev) => ({ ...prev, w: { pressed: true } }));
        break;
      case "s":
        setKeys((prev) => ({ ...prev, s: { pressed: true } }));
        break;
      default:
        break;
    }
  };

  const handleKeyUp = (e) => {
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
      case "control":
        if (isCharging.current) {
          clearInterval(chargeInterval.current);
          const chargeTime = Date.now() - chargeStartTime.current;
          const normalizedCharge =
            Math.min(chargeTime, maxChargeTime) / maxChargeTime;
          const projectileSpeed =
            baseProjectileSpeed +
            (maxProjectileSpeed - baseProjectileSpeed) * normalizedCharge;
          createProjectile(projectileSpeed);
          isCharging.current = false;
          setChargeProgress(0);
        }
        setKeys((prev) => ({ ...prev, control: { pressed: false } }));
        break;
      case "w":
        setKeys((prev) => ({ ...prev, w: { pressed: false } }));
        break;
      case "s":
        setKeys((prev) => ({ ...prev, s: { pressed: false } }));
        break;
      default:
        break;
    }
  };

  const updateAimAngle = async (delta) => {
    const snapshot = await get(playerRef);
    const currentCharacters = snapshot.val()?.characters || [];
    const currentCharacter = currentCharacters[currentCharacterIndex];

    if (!currentCharacter) return;

    const adjustedDelta = isCreator ? delta : -delta;
    currentCharacter.aimAngle =
      (currentCharacter.aimAngle || (isCreator ? 0 : 180)) + adjustedDelta;

    if (currentCharacter.aimAngle < 0) currentCharacter.aimAngle += 360;
    if (currentCharacter.aimAngle >= 360) currentCharacter.aimAngle -= 360;

    currentCharacters[currentCharacterIndex] = currentCharacter;

    await set(playerRef, { ...snapshot.val(), characters: currentCharacters });
  };

  const createProjectile = async (speed) => {
    const snapshot = await get(playerRef);
    const currentCharacters = snapshot.val()?.characters || [];
    const currentCharacter = currentCharacters[currentCharacterIndex];

    if (!currentCharacter) return;

    const angleInRadians =
      ((currentCharacter.aimAngle || (isCreator ? 0 : 180)) * Math.PI) / 180;
    const projectile = {
      x: isCreator
        ? currentCharacter.position.x + 30
        : currentCharacter.position.x - 10,
      y: currentCharacter.position.y + 20,
      velocityX: Math.cos(angleInRadians) * speed,
      velocityY: Math.sin(angleInRadians) * speed,
      active: true,
    };

    currentCharacter.projectiles = [
      ...(currentCharacter.projectiles || []),
      projectile,
    ];

    currentCharacters[currentCharacterIndex] = currentCharacter;

    await set(playerRef, { ...snapshot.val(), characters: currentCharacters });
  };

  const updateCharacterPosition = async () => {
    const snapshot = await get(playerRef);
    const currentCharacters = snapshot.val()?.characters || [];

    const newPlayerCharacters = currentCharacters.map((character, index) => {
      if (index !== currentCharacterIndex) return character;

      if (currentTurn !== user.uid) {
        return {
          ...character,
          projectiles: [],
        };
      }

      if (character.aimAngle === undefined) {
        character.aimAngle = isCreator ? 0 : 180;
      }

      // Movimiento horizontal
      let newX = character.position.x;
      if (keys.a.pressed) newX -= moveAmount;
      if (keys.d.pressed) newX += moveAmount;

      // Salto
      if (
        keys.space.pressed &&
        checkCollision(character.position.x, character.position.y + 1)
      ) {
        character.velocityY = jumpStrength;
      }

      // Aplicar movimiento si no hay colisión
      if (!checkCollision(newX, character.position.y)) {
        character.position.x = newX;
      }

      // Actualizar proyectiles
      if (character.projectiles) {
        character.projectiles = character.projectiles
          .map((projectile) => {
            if (projectile.active) {
              // Aplicar gravedad a proyectiles
              if (projectile.velocityY === undefined) {
                projectile.velocityY = 0;
              }
              projectile.velocityY += gravity * 0.5;

              // Calcular nueva posición
              let nextX = projectile.x + projectile.velocityX;
              let nextY = projectile.y + projectile.velocityY;

              // Verificar colisiones
              if (checkProjectileCollision(nextX, nextY)) {
                console.log("Proyectil impactó en el mapa");
                projectile.active = false;
              }
              // Colisión con enemigos
              else if (
                opponentCharacters.some((char, index) =>
                  checkCharacterCollision(projectile, char)
                )
              ) {
                const hitCharIndex = opponentCharacters.findIndex((char) =>
                  checkCharacterCollision(projectile, char)
                );
                projectile.active = false;
                registerHit({
                  target: isCreator ? "player2" : "player1",
                  characterIndex: hitCharIndex,
                  amount: 10,
                  isAlly: false,
                });
                console.log(`Impacto a enemigo ${hitCharIndex}`);
              }
              // Colisión con aliados (excepto con uno mismo)
              else if (
                playerCharacters.some(
                  (char, idx) =>
                    idx !== currentCharacterIndex &&
                    checkCharacterCollision(projectile, char)
                )
              ) {
                const hitCharIndex = playerCharacters.findIndex(
                  (char, idx) =>
                    idx !== currentCharacterIndex &&
                    checkCharacterCollision(projectile, char)
                );
                projectile.active = false;
                registerHit({
                  target: isCreator ? "player1" : "player2",
                  characterIndex: hitCharIndex,
                  amount: 10,
                  isAlly: true,
                });
                console.log(
                  `Impacto a aliado ${hitCharIndex}`,
                  playerCharacters[hitCharIndex]
                );
              }
              // Sin colisiones, actualizar posición
              else {
                projectile.x = nextX;
                projectile.y = nextY;
              }
            }
            return projectile;
          })
          .filter((p) => p.active); // Filtrar proyectiles inactivos
      }

      return character;
    });

    // Guardar cambios en Firebase
    await set(playerRef, {
      ...snapshot.val(),
      characters: newPlayerCharacters,
    });
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [playerRef, user, currentTurn, currentCharacterIndex]);

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
  }, [keys, currentTurn, user.uid, playerCharacters, opponentCharacters]);

  useEffect(() => {
    const interval = setInterval(() => {
      applyGravity();
    }, 1000 / 60);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let intervalId;

    if (currentTurn === user.uid) {
      intervalId = setInterval(() => {
        if (keys.w.pressed) updateAimAngle(-1);
        if (keys.s.pressed) updateAimAngle(1);
      }, 16);
    }

    return () => clearInterval(intervalId);
  }, [keys.w.pressed, keys.s.pressed, currentTurn, user.uid]);

  useEffect(() => {
    return () => {
      if (chargeInterval.current) {
        clearInterval(chargeInterval.current);
      }
    };
  }, []);

  return null;
};

export default GameControls;
