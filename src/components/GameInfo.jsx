import React from "react";

const GameInfo = ({
  currentTurn,
  user,
  opponent,
  countdown,
  currentCharacterIndex,
}) => {
  return (
    <div className="turn-info">
      <p>
        {currentTurn === user.uid ? (
          <>Es tu turno ({countdown}s)</>
        ) : (
          <>
            Turno de: {opponent.nickname} ({countdown}s)
          </>
        )}
      </p>
      <p>Personaje actual: {currentCharacterIndex + 1}</p>
    </div>
  );
};

export default GameInfo;
