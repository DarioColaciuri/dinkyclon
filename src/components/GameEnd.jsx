import React, { useState } from "react";

const GameEnd = ({ handleEndGame }) => {
  const [showConfirm, setShowConfirm] = useState(false);

  if (showConfirm) {
    return (
      <div className="confirm-container">
        <p className="confirm-warning">
          Vas a retirarte y perderas puntos de ELO.
        </p>
        <div className="confirm-buttons">
          <button
            className="confirm-yes"
            onClick={() => handleEndGame(true)}
          >
            Retirarme
          </button>
          <button
            className="confirm-no"
            onClick={() => setShowConfirm(false)}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setShowConfirm(true)} className="back-button">
      Finalizar partida
    </button>
  );
};

export default GameEnd;
