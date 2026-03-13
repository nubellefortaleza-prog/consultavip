import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// Animated background particle
function Particle({ style }: { style: React.CSSProperties }) {
  return <div style={style} />;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [particles, setParticles] = useState<React.CSSProperties[]>([]);

  useEffect(() => {
    const generated = Array.from({ length: 18 }, (_, i) => {
      const size = Math.random() * 3 + 1;
      const x = Math.random() * 100;
      const delay = Math.random() * 8;
      const duration = Math.random() * 10 + 12;
      const opacity = Math.random() * 0.4 + 0.1;
      return {
        position: "absolute" as const,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        left: `${x}%`,
        bottom: "-10px",
        backgroundColor: i % 3 === 0 ? "#F2D9C2" : i % 3 === 1 ? "#AABAA4" : "#c9a87a",
        opacity,
        animation: `floatUp ${duration}s ${delay}s ease-in infinite`,
        pointerEvents: "none" as const,
      };
    });
    setParticles(generated);
  }, []);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao fazer login");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <>
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 0.6; }
          100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
        }
        @keyframes gradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes orbPulse {
          0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.15; }
          33%       { transform: scale(1.15) translate(20px, -30px); opacity: 0.25; }
          66%       { transform: scale(0.9) translate(-15px, 20px); opacity: 0.12; }
        }
        @keyframes orbPulse2 {
          0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.12; }
          33%       { transform: scale(0.85) translate(-25px, 15px); opacity: 0.22; }
          66%       { transform: scale(1.2) translate(10px, -20px); opacity: 0.1; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .login-card {
          animation: fadeSlideUp 0.7s ease forwards;
        }
        .login-input:focus {
          border-color: #c9a87a !important;
          box-shadow: 0 0 0 3px rgba(201,168,122,0.15) !important;
        }
        .login-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #2a2a2b 0%, #1A1A1B 100%) !important;
          box-shadow: 0 4px 20px rgba(242,217,194,0.2) !important;
          transform: translateY(-1px);
        }
        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .logo-shimmer {
          background: linear-gradient(90deg, #F2D9C2 0%, #fff8f0 40%, #c9a87a 50%, #fff8f0 60%, #F2D9C2 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
      `}</style>

      {/* Background */}
      <div
        style={{
          minHeight: "100vh",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #0d0d0e 0%, #1A1A1B 40%, #111213 70%, #0a0c0b 100%)",
          backgroundSize: "400% 400%",
          animation: "gradientShift 15s ease infinite",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        {/* Glowing orb 1 */}
        <div
          style={{
            position: "absolute",
            width: "520px",
            height: "520px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(201,168,122,0.18) 0%, transparent 70%)",
            top: "-100px",
            right: "-100px",
            animation: "orbPulse 14s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
        {/* Glowing orb 2 */}
        <div
          style={{
            position: "absolute",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(170,186,164,0.14) 0%, transparent 70%)",
            bottom: "-80px",
            left: "-80px",
            animation: "orbPulse2 18s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
        {/* Glowing orb 3 */}
        <div
          style={{
            position: "absolute",
            width: "250px",
            height: "250px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(242,217,194,0.1) 0%, transparent 70%)",
            top: "50%",
            left: "15%",
            animation: "orbPulse 20s ease-in-out infinite reverse",
            pointerEvents: "none",
          }}
        />

        {/* Floating particles */}
        {particles.map((style, i) => (
          <Particle key={i} style={style} />
        ))}

        {/* Grid overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(242,217,194,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(242,217,194,0.03) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            pointerEvents: "none",
          }}
        />

        {/* Card */}
        <div
          className="login-card"
          style={{
            width: "100%",
            maxWidth: "420px",
            position: "relative",
            zIndex: 10,
          }}
        >
          {/* Logo area */}
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            {/* SVG Logo mark */}
            <div style={{ display: "inline-block", marginBottom: "16px" }}>
              <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="36" cy="36" r="35" stroke="#F2D9C2" strokeWidth="1" opacity="0.6" />
                <circle cx="36" cy="36" r="28" stroke="#c9a87a" strokeWidth="0.5" opacity="0.4" />
                {/* Stylized V */}
                <path d="M20 22 L36 50 L52 22" stroke="#F2D9C2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                {/* Star accent */}
                <circle cx="36" cy="50" r="2" fill="#c9a87a" />
                <circle cx="20" cy="22" r="2" fill="#c9a87a" />
                <circle cx="52" cy="22" r="2" fill="#c9a87a" />
              </svg>
            </div>
            <h1
              className="logo-shimmer"
              style={{
                margin: 0,
                fontSize: "32px",
                letterSpacing: "6px",
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontWeight: "normal",
                display: "block",
              }}
            >
              VIP ESTETIC
            </h1>
            <p
              style={{
                color: "#AABAA4",
                margin: "8px 0 0",
                fontSize: "11px",
                letterSpacing: "3px",
                textTransform: "uppercase",
                opacity: 0.8,
              }}
            >
              Consulta VIP
            </p>
          </div>

          {/* Form card */}
          <div
            style={{
              background: "rgba(249,247,242,0.97)",
              borderRadius: "20px",
              overflow: "hidden",
              boxShadow:
                "0 0 0 1px rgba(242,217,194,0.2), 0 20px 60px rgba(0,0,0,0.5), 0 4px 20px rgba(201,168,122,0.15)",
              backdropFilter: "blur(10px)",
            }}
          >
            <form onSubmit={handleSubmit} style={{ padding: "36px 32px" }}>
              <div style={{ marginBottom: "22px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "#3a3a3b",
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    marginBottom: "8px",
                  }}
                >
                  E-mail
                </label>
                <input
                  className="login-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  style={{
                    width: "100%",
                    padding: "13px 16px",
                    border: "1.5px solid #e8ddd0",
                    borderRadius: "10px",
                    fontSize: "14px",
                    color: "#1A1A1B",
                    backgroundColor: "white",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                />
              </div>

              <div style={{ marginBottom: "32px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "#3a3a3b",
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    marginBottom: "8px",
                  }}
                >
                  Senha
                </label>
                <input
                  className="login-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{
                    width: "100%",
                    padding: "13px 16px",
                    border: "1.5px solid #e8ddd0",
                    borderRadius: "10px",
                    fontSize: "14px",
                    color: "#1A1A1B",
                    backgroundColor: "white",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                />
              </div>

              <button
                type="submit"
                className="login-btn"
                disabled={loginMutation.isPending}
                style={{
                  width: "100%",
                  padding: "15px",
                  background: loginMutation.isPending
                    ? "#AABAA4"
                    : "linear-gradient(135deg, #1A1A1B 0%, #2d2d2f 100%)",
                  color: "#F2D9C2",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: "700",
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  cursor: loginMutation.isPending ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: loginMutation.isPending ? "none" : "0 4px 15px rgba(0,0,0,0.3)",
                }}
              >
                {loginMutation.isPending ? "Entrando..." : "Entrar"}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p
            style={{
              textAlign: "center",
              color: "rgba(242,217,194,0.3)",
              fontSize: "10px",
              letterSpacing: "1px",
              marginTop: "24px",
            }}
          >
            © {new Date().getFullYear()} VIP ESTETIC · Sistema Exclusivo
          </p>
        </div>
      </div>
    </>
  );
}
