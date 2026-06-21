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
  opponentCharacterIndex,
  chargeProgress,
  explosions,
  dyingCharacters,
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
          exp.x, exp.y, exp.size * 0.3,
          exp.x, exp.y, exp.size
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

      const isDying = (side, index) => {
        return dyingCharacters.some((d) => d.side === side && d.index === index);
      };

      const getDeathProgress = (side, index) => {
        const d = dyingCharacters.find((x) => x.side === side && x.index === index);
        if (!d) return 0;
        return Math.min((Date.now() - d.startTime) / 600, 1);
      };

      const drawCharacter = (character, image, isOpponent, isActive, index, side) => {
        const life = character.life ?? 100;
        const dying = isDying(side, index);
        const deathProgress = dying ? getDeathProgress(side, index) : 0;

        if (life <= 0 && !dying) return;

        if (image) {
          ctx.save();
          if (dying) {
            ctx.globalAlpha = 1 - deathProgress;
            const scale = 1 + deathProgress * 0.3;
            const cx = character.position.x + 15;
            const cy = character.position.y + 20;
            ctx.translate(cx, cy);
            ctx.scale(scale, scale);
            ctx.translate(-cx, -cy);
          }

          ctx.drawImage(
            image,
            character.position.x,
            character.position.y,
            30,
            40
          );

          if (!dying) {
            const barWidth = 30;
            const barHeight = 5;
            const barX = character.position.x;
            const barY = character.position.y - 10;

            ctx.fillStyle = "yellow";
            ctx.fillRect(barX, barY, barWidth, barHeight);

            const lifeWidth = (life / 100) * barWidth;
            ctx.fillStyle = "red";
            ctx.fillRect(barX, barY, lifeWidth, barHeight);
          }

          ctx.restore();
        }

        if (life <= 0) return;

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
            ctx.fillRect(chargeBarX, chargeBarY, chargeBarWidth, chargeBarHeight);

            ctx.fillStyle = crosshairColor;
            ctx.fillRect(
              chargeBarX, chargeBarY,
              chargeBarWidth * chargeProgress, chargeBarHeight
            );

            ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
            ctx.lineWidth = 1;
            ctx.strokeRect(chargeBarX, chargeBarY, chargeBarWidth, chargeBarHeight);
          }
        }
      };

      const isPlayerTurn = currentTurn === user.uid;

      playerCharacters.forEach((character, index) => {
        const dyingEntry = dyingCharacters.find((d) => d.side === "player" && d.index === index);
        drawCharacter(
          character,
          playerImage,
          false,
          isPlayerTurn && index === currentCharacterIndex,
          index,
          "player"
        );
      });

      opponentCharacters.forEach((character, index) => {
        const dyingEntry = dyingCharacters.find((d) => d.side === "opponent" && d.index === index);
        drawCharacter(
          character,
          opponentImage,
          true,
          !isPlayerTurn && index === opponentCharacterIndex,
          index,
          "opponent"
        );
      });

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
    opponentCharacterIndex,
    chargeProgress,
    explosions,
    dyingCharacters,
  ]);

  return (
    <canvas ref={canvasRef} width={800} height={600} className="game-canvas" />
  );
};

export default GameCanvas;
