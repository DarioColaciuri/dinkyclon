import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { supabase } from "./supabase/supabase";
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user);
      } else {
        setUser(null);
        setUserData(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (authUser) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .single();
    setUserData(data);
  };

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
