import React, { useEffect, useState, useRef } from "react";
import { get, set } from "firebase/database";

const GameControls = ({
  currentTurn,
  user,
  playerRef,
  currentCharacterIndex,
  map,
  isCreator,
  setChargeProgress,
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

      // === SOLUCIÓN: Limpiar proyectiles si no es nuestro turno ===
      if (currentTurn !== user.uid) {
        return {
          ...character,
          projectiles: [],
        };
      }

      if (character.aimAngle === undefined) {
        character.aimAngle = isCreator ? 0 : 180;
      }

      let newX = character.position.x;
      if (keys.a.pressed) newX -= moveAmount;
      if (keys.d.pressed) newX += moveAmount;

      if (
        keys.space.pressed &&
        checkCollision(character.position.x, character.position.y + 1)
      ) {
        character.velocityY = jumpStrength;
      }

      if (!checkCollision(newX, character.position.y)) {
        character.position.x = newX;
      }

      if (character.projectiles) {
        character.projectiles = character.projectiles
          .map((projectile) => {
            if (projectile.active) {
              if (projectile.velocityY === undefined) {
                projectile.velocityY = 0;
              }
              projectile.velocityY += gravity * 0.5;

              let nextX = projectile.x + projectile.velocityX;
              let nextY = projectile.y + projectile.velocityY;

              if (checkProjectileCollision(nextX, nextY)) {
                projectile.active = false;
              } else {
                projectile.x = nextX;
                projectile.y = nextY;
              }
            }
            return projectile;
          })
          .filter((p) => p.active);
      }

      return character;
    });

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
  }, [keys, currentTurn, user.uid]);

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
