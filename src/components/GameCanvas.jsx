import React, { useEffect } from "react";

const GameCanvas = ({
  canvasRef,
  backgroundImage,
  map,
  playerCharacters,
  opponentCharacters,
  playerImage,
  opponentImage,
  currentTurn,
  user = { uid: null }, // Valor por defecto para `user`
  currentCharacterIndex,
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

      const drawCharacter = (character, image, isOpponent, isActive) => {
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

        // Dibujar la mira de apuntado solo si es el personaje activo
        if (isActive && character.aimAngle !== undefined) {
          const centerX = character.position.x + 15;
          const centerY = character.position.y + 20;

          const angleInRadians = (character.aimAngle * Math.PI) / 180;
          const targetX = centerX + Math.cos(angleInRadians) * 50;
          const targetY = centerY + Math.sin(angleInRadians) * 50;

          // Dibujar la línea de apuntado
          ctx.strokeStyle = "black";
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(targetX, targetY);
          ctx.stroke();

          // Dibujar la mira
          ctx.fillStyle = "black";
          ctx.beginPath();
          ctx.arc(targetX, targetY, 5, 0, 2 * Math.PI);
          ctx.fill();
        }
      };

      // Determinar si es el turno del jugador
      const isPlayerTurn = currentTurn === user.uid;

      // Dibujar los personajes del jugador y sus proyectiles
      playerCharacters.forEach((character, index) =>
        drawCharacter(
          character,
          playerImage,
          false,
          isPlayerTurn && index === currentCharacterIndex
        )
      );

      // Dibujar los personajes del oponente y sus proyectiles
      opponentCharacters.forEach((character, index) =>
        drawCharacter(
          character,
          opponentImage,
          true,
          !isPlayerTurn && index === currentCharacterIndex
        )
      );

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    playerCharacters,
    opponentCharacters,
    map,
    backgroundImage,
    currentTurn,
    user.uid,
    currentCharacterIndex,
  ]);

  return (
    <canvas ref={canvasRef} width={800} height={600} className="game-canvas" />
  );
};

export default GameCanvas;
