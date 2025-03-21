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

      // Dibujar los personajes del jugador y sus barras de vida
      playerCharacters.forEach(({ position, life }) => {
        if (playerImage) {
          ctx.drawImage(playerImage, position.x, position.y, 30, 40);

          // Dibujar la barra de vida
          const barWidth = 30; // Ancho de la barra de vida
          const barHeight = 5; // Altura de la barra de vida
          const barX = position.x; // Posición X de la barra de vida
          const barY = position.y - 10; // Posición Y de la barra de vida (encima del personaje)

          // Fondo de la barra de vida (amarillo)
          ctx.fillStyle = "yellow";
          ctx.fillRect(barX, barY, barWidth, barHeight);

          // Vida actual (rojo)
          const lifeWidth = (life / 100) * barWidth; // Calcular el ancho de la vida
          ctx.fillStyle = "red";
          ctx.fillRect(barX, barY, lifeWidth, barHeight);
        }
      });

      // Dibujar los personajes del oponente y sus barras de vida
      opponentCharacters.forEach(({ position, life }) => {
        if (opponentImage) {
          ctx.drawImage(opponentImage, position.x, position.y, 30, 40);

          // Dibujar la barra de vida
          const barWidth = 30; // Ancho de la barra de vida
          const barHeight = 5; // Altura de la barra de vida
          const barX = position.x; // Posición X de la barra de vida
          const barY = position.y - 10; // Posición Y de la barra de vida (encima del personaje)

          // Fondo de la barra de vida (amarillo)
          ctx.fillStyle = "yellow";
          ctx.fillRect(barX, barY, barWidth, barHeight);

          // Vida actual (rojo)
          const lifeWidth = (life / 100) * barWidth; // Calcular el ancho de la vida
          ctx.fillStyle = "red";
          ctx.fillRect(barX, barY, lifeWidth, barHeight);
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
