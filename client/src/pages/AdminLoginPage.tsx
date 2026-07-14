import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrandShell } from "../components/BrandShell";
import { Logo } from "../components/Logo";
import { adminLogin } from "../lib/api";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const token = await adminLogin(password);
      localStorage.setItem("perfo-admin-token", token);
      navigate("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.");
    }
  }

  return (
    <BrandShell>
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
        <Logo />
        <form onSubmit={submit} className="glass mt-8 rounded-lg p-6">
          <h1 className="text-3xl font-black">Administration</h1>
          <p className="mt-2 text-slate-300">Connectez-vous pour gerer la banque de questions et les quiz.</p>
          {error && <div className="mt-4 rounded-md border border-red-400/30 bg-red-500/15 p-3 text-red-100">{error}</div>}
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="Mot de passe admin"
            className="mt-6 w-full rounded-md border border-white/10 bg-slate-950 px-4 py-3 outline-none ring-perfo-blue focus:ring-2"
          />
          <button type="submit" className="mt-4 w-full rounded-md bg-perfo-blue px-4 py-3 font-black shadow-glow">
            Se connecter
          </button>
        </form>
      </div>
    </BrandShell>
  );
}
