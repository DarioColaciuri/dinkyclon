import React, { useEffect, useState } from "react";
import { get, set } from "firebase/database";

const GameControls = ({
  currentTurn,
  user,
  playerRef,
  currentCharacterIndex,
  map,
}) => {
  const gravity = 0.5;
  const jumpStrength = -10;
  const tileSize = 10;
  const moveAmount = 5;
  const projectileSpeed = 10;

  const [keys, setKeys] = useState({
    a: { pressed: false },
    d: { pressed: false },
    space: { pressed: false },
    control: { pressed: false },
  });

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

      if (character.projectiles) {
        character.projectiles = character.projectiles
          .map((projectile) => {
            if (projectile.active) {
              let newY = projectile.y + (projectile.velocityY || 0);
              if (!checkProjectileCollision(projectile.x, newY)) {
                projectile.velocityY = (projectile.velocityY || 0) + gravity;
                projectile.y = newY;
              } else {
                projectile.active = false;
              }
            }
            return projectile;
          })
          .filter((p) => p.active);
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
        setKeys((prev) => ({ ...prev, control: { pressed: true } }));
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
        setKeys((prev) => ({ ...prev, control: { pressed: false } }));
        break;
      default:
        break;
    }
  };

  const createProjectile = async () => {
    const snapshot = await get(playerRef);
    const currentCharacters = snapshot.val()?.characters || [];
    const currentCharacter = currentCharacters[currentCharacterIndex];

    if (!currentCharacter) return;

    const projectile = {
      x: currentCharacter.position.x + 30,
      y: currentCharacter.position.y + 20,
      velocityX: projectileSpeed,
      velocityY: 0,
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
    if (keys.control.pressed && currentTurn === user.uid) {
      createProjectile();
    }
  }, [keys.control.pressed, currentTurn, user.uid]);

  return null;
};

export default GameControls;
