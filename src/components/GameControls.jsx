import React, { useEffect } from "react";
import { get, set } from "firebase/database";

const GameControls = ({
  currentTurn,
  user,
  playerRef,
  currentCharacterIndex,
  map,
}) => {
  const checkCollision = (x, y) => {
    const width = 30;
    const height = 40;
    const tileSize = 10;

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

  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (currentTurn !== user.uid) return;

      const moveAmount = 10;
      const snapshot = await get(playerRef);
      const currentCharacters = snapshot.val()?.characters || [];

      const newPlayerCharacters = currentCharacters.map((character, index) => {
        if (index !== currentCharacterIndex) return character;

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

        if (!checkCollision(newX, newY)) {
          return { ...character, position: { x: newX, y: newY } };
        } else {
          return character;
        }
      });

      await set(playerRef, { ...user, characters: newPlayerCharacters });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playerRef, user, currentTurn, currentCharacterIndex]);

  return null;
};

export default GameControls;
