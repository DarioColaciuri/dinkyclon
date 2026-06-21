import React, { useEffect } from "react";

const GameControls = ({ ws, currentTurn, user }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        !ws ||
        ws.readyState !== 1 ||
        !user?.uid ||
        currentTurn !== user.uid
      )
        return;

      if (e.key === " ") e.preventDefault();

      let key = e.key.toLowerCase();
      if (key === " ") key = "space";

      ws.send(JSON.stringify({ type: "input", action: "keydown", key }));
    };

    const handleKeyUp = (e) => {
      if (!ws || ws.readyState !== 1) return;

      let key = e.key.toLowerCase();
      if (key === " ") key = "space";

      ws.send(JSON.stringify({ type: "input", action: "keyup", key }));
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [ws, currentTurn, user?.uid]);

  return null;
};

export default GameControls;
