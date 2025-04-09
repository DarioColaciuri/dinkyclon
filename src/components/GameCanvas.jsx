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
  explosions,
}) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animationFrameId;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (backgroundImage) {
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
      }

      map.forEach((tile, index) => {
        if (tile === 1) {
          const col = index % 80;
          const row = Math.floor(index / 80);
          ctx.fillStyle = "rgba(255, 255, 0, 0.267)";
          ctx.fillRect(col * 10, row * 10, 10, 10);
        }
      });

      explosions.forEach((exp) => {
        const gradient = ctx.createRadialGradient(
          exp.x,
          exp.y,
          exp.size * 0.3,
          exp.x,
          exp.y,
          exp.size
        );
        gradient.addColorStop(0, `rgba(255, 200, 100, ${exp.alpha})`);
        gradient.addColorStop(0.7, `rgba(255, 100, 0, ${exp.alpha * 0.7})`);
        gradient.addColorStop(1, `rgba(255, 0, 0, 0)`);

        ctx.beginPath();
        ctx.arc(exp.x, exp.y, exp.size, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(exp.x, exp.y, exp.size * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 200, ${exp.alpha})`;
        ctx.fill();
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

        if (character.projectiles) {
          character.projectiles.forEach((projectile) => {
            if (projectile.active) {
              ctx.fillStyle = isOpponent ? "blue" : "red";
              ctx.fillRect(projectile.x, projectile.y, 10, 10);
            }
          });
        }

        if (isActive && character.aimAngle !== undefined) {
          const centerX = character.position.x + 15;
          const centerY = character.position.y + 20;

          const angleInRadians = (character.aimAngle * Math.PI) / 180;
          const targetX = centerX + Math.cos(angleInRadians) * 50;
          const targetY = centerY + Math.sin(angleInRadians) * 50;

          ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(targetX, targetY);
          ctx.stroke();

          const crosshairSize = 20;
          const crosshairColor = isOpponent
            ? "rgba(0, 100, 255, 0.8)"
            : "rgba(255, 50, 50, 0.8)";

          ctx.beginPath();
          ctx.arc(targetX, targetY, crosshairSize / 2, 0, Math.PI * 2);
          ctx.strokeStyle = crosshairColor;
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(targetX, targetY, crosshairSize / 4, 0, Math.PI * 2);
          ctx.strokeStyle = crosshairColor;
          ctx.lineWidth = 1;
          ctx.stroke();

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

          ctx.beginPath();
          ctx.arc(targetX, targetY, 2, 0, Math.PI * 2);
          ctx.fillStyle = crosshairColor;
          ctx.fill();

          if (chargeProgress > 0 && currentTurn === user.uid) {
            const chargeBarWidth = 50;
            const chargeBarHeight = 6;
            const chargeBarX = targetX - chargeBarWidth / 2;
            const chargeBarY = targetY - crosshairSize - 10;

            ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
            ctx.fillRect(
              chargeBarX,
              chargeBarY,
              chargeBarWidth,
              chargeBarHeight
            );

            ctx.fillStyle = crosshairColor;
            ctx.fillRect(
              chargeBarX,
              chargeBarY,
              chargeBarWidth * chargeProgress,
              chargeBarHeight
            );

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

      const isPlayerTurn = currentTurn === user.uid;

      playerCharacters.forEach((character, index) =>
        drawCharacter(
          character,
          playerImage,
          false,
          isPlayerTurn && index === currentCharacterIndex
        )
      );

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
    explosions,
  ]);

  return (
    <canvas ref={canvasRef} width={800} height={600} className="game-canvas" />
  );
};

export default GameCanvas;
