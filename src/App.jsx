import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { auth } from "./firebase/firebase";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "./firebase/firebase";
import Auth from "./components/Auth";
import Lobby from "./components/Lobby";
import Game from "./components/Game";

const AppWrapper = () => {
  return (
    <Router>
      <App />
    </Router>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);

  // Escucha cambios en la autenticación
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setUser(user);

        // Obtener información adicional del usuario desde Firestore
        const userDoc = await getDoc(doc(firestore, "users", user.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } else {
        setUser(null);
        setUserData(null);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Auth setUser={setUser} />} />
      <Route
        path="/lobby"
        element={<Lobby user={user} userData={userData} />}
      />
      <Route path="/game" element={<Game user={user} />} />
    </Routes>
  );
};

export default AppWrapper;
