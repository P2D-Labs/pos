import axios from "axios";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { buildAuthState, setAuthState } from "../models/auth";
import { api } from "../services/api";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await api.post("/auth/login", { email, password });
      setAuthState(
        buildAuthState({
          accessToken: response.data.data.accessToken,
          refreshToken: response.data.data.refreshToken,
        }),
      );
      navigate("/");
    } catch (error) {
      if (axios.isAxiosError(error)) setMessage(error.response?.data?.message ?? "Login failed");
      else setMessage("Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <h2>Login</h2>
        <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
        {message ? <p>{message}</p> : null}
        <Link to="/setup">First-time setup</Link>
        <Link to="/forgot-password">Forgot password?</Link>
      </form>
    </section>
  );
}
