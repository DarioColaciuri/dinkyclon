import React from "react";

const Level1 = () => {
  // Crear un array unidimensional de 80x60 = 4800 elementos
  const map = new Array(80 * 60).fill(0);

  // Definir los bordes del mapa como 1 (amarillo)
  for (let i = 0; i < 4800; i++) {
    const col = i % 80; // Columna actual
    const row = Math.floor(i / 80); // Fila actual

    // Si es la primera fila, última fila, primera columna o última columna, poner 1
    if (row === 0 || row === 59 || col === 0 || col === 79) {
      map[i] = 1;
    }
  }

  return map;
};

export default Level1;
