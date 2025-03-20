import React from "react";

const GameEnd = ({ handleEndGame }) => {
  return (
    <button onClick={handleEndGame} className="back-button">
      Volver al lobby
    </button>
  );
};

export default GameEnd;
