"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ui/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [particulas, setParticulas] = useState([]);
  const [anio, setAnio] = useState(null);

  // Las partículas dependen de Math.random y el año del reloj local: se
  // generan solo en el cliente para evitar el mismatch de hidratación.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setParticulas(
      Array.from({ length: 22 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: Math.random() * 4 + 2,
        duration: Math.random() * 12 + 10,
        delay: Math.random() * 8,
        opacity: Math.random() * 0.4 + 0.15,
      }))
    );
    setAnio(new Date().getFullYear());
  }, []);

  useEffect(() => {
    // Si ya hay sesión, ir directo al dashboard
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) router.replace("/dashboard");
      })
      .catch(() => {});
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.detail || "No se pudo iniciar sesión.");
        setLoading(false);
        return;
      }

      router.replace("/dashboard");
    } catch (err) {
      setError("Error de conexión. Intenta nuevamente.");
      setLoading(false);
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-theme-toggle">
        <ThemeToggle />
      </div>
      {particulas.map((p) => (
        <span
          key={p.id}
          className="particle"
          style={{
            left: `${p.left}%`,
            bottom: -10,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      <div className="login-card">
        <div className="login-logo">
          <div className="logo-circle">🦷</div>
          <h1>Smilesoft Dental</h1>
          <p>Sistema de gestión para consultorio odontológico</p>
          <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
            Acceso seguro con autenticación por tokens
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label className="label" htmlFor="email">
              Correo electrónico
            </label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              placeholder="admin@consultorio.bo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label className="label" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div
              style={{
                padding: "10px 12px",
                marginBottom: 14,
                background: "var(--danger-ghost)",
                border: "1px solid rgba(251,113,133,0.35)",
                color: "var(--danger)",
                borderRadius: 10,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", height: 46 }}
            disabled={loading}
          >
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>

        <hr className="divider" />
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-faint)", margin: 0 }}>
          Smilesoft © {anio || new Date().getFullYear()} — Consultorio dental ·{" "}
          <a href="/docs" style={{ color: "var(--accent-soft)", textDecoration: "none" }}>
            Documentación API
          </a>
        </p>
      </div>
    </div>
  );
}