import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, firestore } from "../firebase/firebase";
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
        // Iniciar sesión
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Registrarse
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const user = userCredential.user;

        // Guardar informacion en Firestore
        await setDoc(doc(firestore, "users", user.uid), {
          email: user.email,
          nickname: nickname,
          elo: 500,
        });
      }
      navigate("/lobby");
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="auth-container">
      <h2>{isLogin ? "Iniciar sesión" : "Registrarse"}</h2>
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
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">
          {isLogin ? "Iniciar sesión" : "Registrarse"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      <button onClick={() => setIsLogin(!isLogin)} className="toggle-button">
        {isLogin
          ? "¿No tienes cuenta? Regístrate"
          : "¿Ya tienes cuenta? Inicia sesión"}
      </button>
    </div>
  );
};

export default Auth;
