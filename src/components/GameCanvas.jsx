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
  user = { uid: null },
  currentCharacterIndex,
  chargeProgress,
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
          ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(targetX, targetY);
          ctx.stroke();

          // Dibujar mira estilizada
          const crosshairSize = 20;
          const crosshairColor = isOpponent
            ? "rgba(0, 100, 255, 0.8)"
            : "rgba(255, 50, 50, 0.8)";

          // Círculo exterior
          ctx.beginPath();
          ctx.arc(targetX, targetY, crosshairSize / 2, 0, Math.PI * 2);
          ctx.strokeStyle = crosshairColor;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Círculo interior
          ctx.beginPath();
          ctx.arc(targetX, targetY, crosshairSize / 4, 0, Math.PI * 2);
          ctx.strokeStyle = crosshairColor;
          ctx.lineWidth = 1;
          ctx.stroke();

          // Líneas cruzadas
          ctx.beginPath();
          ctx.moveTo(targetX - crosshairSize / 2, targetY);
          ctx.lineTo(targetX - crosshairSize / 4, targetY);
          ctx.moveTo(targetX + crosshairSize / 4, targetY);
          ctx.lineTo(targetX + crosshairSize / 2, targetY);
          ctx.moveTo(targetX, targetY - crosshairSize / 2);
          ctx.lineTo(targetX, targetY - crosshairSize / 4);
          ctx.moveTo(targetX, targetY + crosshairSize / 4);
          ctx.lineTo(targetX, targetY + crosshairSize / 2);
          ctx.strokeStyle = crosshairColor;
          ctx.lineWidth = 1;
          ctx.stroke();

          // Punto central
          ctx.beginPath();
          ctx.arc(targetX, targetY, 2, 0, Math.PI * 2);
          ctx.fillStyle = crosshairColor;
          ctx.fill();

          // Dibujar barra de carga si hay progreso
          if (chargeProgress > 0 && currentTurn === user.uid) {
            const chargeBarWidth = 50;
            const chargeBarHeight = 6;
            const chargeBarX = targetX - chargeBarWidth / 2;
            const chargeBarY = targetY - crosshairSize - 10;

            // Fondo de la barra de carga
            ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
            ctx.fillRect(
              chargeBarX,
              chargeBarY,
              chargeBarWidth,
              chargeBarHeight
            );

            // Barra de carga progresiva
            ctx.fillStyle = crosshairColor;
            ctx.fillRect(
              chargeBarX,
              chargeBarY,
              chargeBarWidth * chargeProgress,
              chargeBarHeight
            );

            // Borde de la barra
            ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
            ctx.lineWidth = 1;
            ctx.strokeRect(
              chargeBarX,
              chargeBarY,
              chargeBarWidth,
              chargeBarHeight
            );
          }
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
    chargeProgress,
  ]);

  return (
    <canvas ref={canvasRef} width={800} height={600} className="game-canvas" />
  );
};

export default GameCanvas;
