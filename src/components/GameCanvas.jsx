import React, { useEffect } from "react";

const GameCanvas = ({
  canvasRef,
  backgroundImage,
  map,
  playerCharacters,
  opponentCharacters,
  playerImage,
  opponentImage,
}) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animationFrameId;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Dibujar el fondo
      if (backgroundImage) {
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
      }

      // Dibujar los tiles del mapa
      map.forEach((tile, index) => {
        if (tile === 1) {
          const col = index % 80;
          const row = Math.floor(index / 80);
          ctx.fillStyle = "rgba(255, 255, 0, 0.267)";
          ctx.fillRect(col * 10, row * 10, 10, 10);
        }
      });

      const drawCharacter = (character, image, isOpponent) => {
        if (image) {
          ctx.drawImage(
            image,
            character.position.x,
            character.position.y,
            30,
            40
          );

          // Dibujar la barra de vida
          const barWidth = 30;
          const barHeight = 5;
          const barX = character.position.x;
          const barY = character.position.y - 10;

          ctx.fillStyle = "yellow";
          ctx.fillRect(barX, barY, barWidth, barHeight);

          const lifeWidth = (character.life / 100) * barWidth;
          ctx.fillStyle = "red";
          ctx.fillRect(barX, barY, lifeWidth, barHeight);
        }

        // Dibujar proyectiles
        if (character.projectiles) {
          character.projectiles.forEach((projectile) => {
            if (projectile.active) {
              ctx.fillStyle = isOpponent ? "blue" : "red";
              ctx.fillRect(projectile.x, projectile.y, 10, 10);
            }
          });
        }
      };

      // Dibujar los personajes del jugador y sus proyectiles
      playerCharacters.forEach((character) =>
        drawCharacter(character, playerImage, false)
      );

      // Dibujar los personajes del oponente y sus proyectiles
      opponentCharacters.forEach((character) =>
        drawCharacter(character, opponentImage, true)
      );

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationFrameId);
  }, [playerCharacters, opponentCharacters, map, backgroundImage]);

  return (
    <canvas ref={canvasRef} width={800} height={600} className="game-canvas" />
  );
};

export default GameCanvas;
