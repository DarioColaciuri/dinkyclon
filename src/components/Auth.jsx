import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase/supabase";
import "../css/Auth.css";

const Auth = ({ setUser }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState("");

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { nickname },
          },
        });
        if (error) throw error;
      }
      navigate("/lobby");
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="auth-container">
      <h2>{isLogin ? "Iniciar sesion" : "Registrarse"}</h2>
      <form onSubmit={handleAuth} className="auth-form">
        {!isLogin && (
          <input
            type="text"
            placeholder="Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
          />
        )}
        <input
          type="email"
          placeholder="Correo electronico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Contrasena"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">
          {isLogin ? "Iniciar sesion" : "Registrarse"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      <button onClick={() => setIsLogin(!isLogin)} className="toggle-button">
        {isLogin
          ? "No tienes cuenta? Registrate"
          : "Ya tienes cuenta? Inicia sesion"}
      </button>
    </div>
  );
};

export default Auth;
