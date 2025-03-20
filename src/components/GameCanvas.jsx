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

      playerCharacters.forEach(({ position }) => {
        if (playerImage) {
          ctx.drawImage(playerImage, position.x, position.y, 30, 40);
        }
      });

      opponentCharacters.forEach(({ position }) => {
        if (opponentImage) {
          ctx.drawImage(opponentImage, position.x, position.y, 30, 40);
        }
      });

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
