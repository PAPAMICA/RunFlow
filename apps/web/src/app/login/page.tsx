"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await api.login(email, password);
      setToken(res.access_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-md p-8 bg-card border border-border rounded-lg">
        <h1 className="text-2xl font-bold mb-6">RunFlow</h1>
        {error && <p className="text-red-400 mb-4 text-sm">{error}</p>}
        <label className="block mb-4">
          <span className="text-sm text-muted">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-background border border-border rounded"
            required
          />
        </label>
        <label className="block mb-6">
          <span className="text-sm text-muted">Mot de passe</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-background border border-border rounded"
            required
          />
        </label>
        <button type="submit" className="w-full py-2 bg-primary text-white rounded font-medium">
          Connexion
        </button>
      </form>
    </div>
  );
}
