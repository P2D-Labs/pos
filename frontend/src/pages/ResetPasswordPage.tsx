import axios from "axios";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    try {
      await api.post("/auth/reset-password", { token, password });
      setMessage("Password reset successful.");
      setError("");
      setTimeout(() => navigate("/login"), 700);
    } catch (submitError) {
      if (axios.isAxiosError(submitError)) setError(submitError.response?.data?.message ?? "Failed");
    }
  }

  return (
    <section className="auth-shell">
      <div className="auth-card">
        <h2>Reset Password</h2>
        <input
          placeholder="Reset token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <input
          placeholder="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={submit}>Reset password</button>
        {message ? <p>{message}</p> : null}
        {error ? <p>{error}</p> : null}
        <Link to="/login">Back to login</Link>
      </div>
    </section>
  );
}
