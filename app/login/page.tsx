"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type LoginResponse = {
  success?: boolean;
  error?: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    role: "ADMIN" | "COACH";
  };
};

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data: LoginResponse = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Unable to log in.");
        return;
      }

      if (data.user?.role === "ADMIN") {
        router.push("/headcount");
      } else {
        router.push("/coach");
      }

      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark">
          <span className="brand-s">S</span>
        </div>

        <p className="club-name">SPRINGSIDE ATHLETIC CLUB</p>

        <h1>Clinic Headcount</h1>

        <p className="subtitle">
          Sign in to access the coach or administrator dashboard.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="username">Username</label>

            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>

            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </section>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background:
            linear-gradient(
              135deg,
              rgba(28, 28, 91, 0.96),
              rgba(32, 32, 32, 0.96)
            );
          font-family: Arial, Helvetica, sans-serif;
        }

        .login-card {
          width: 100%;
          max-width: 430px;
          padding: 40px;
          border-top: 7px solid #f3a000;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 22px 60px rgba(0, 0, 0, 0.32);
        }

        .brand-mark {
          width: 74px;
          height: 74px;
          margin: 0 auto 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 5px solid #f3a000;
          border-radius: 50%;
          background: #1c1c5b;
        }

        .brand-s {
          color: #ffffff;
          font-size: 46px;
          font-weight: 800;
          line-height: 1;
        }

        .club-name {
          margin: 0 0 12px;
          color: #1c1c5b;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 1.4px;
          text-align: center;
        }

        h1 {
          margin: 0;
          color: #202020;
          font-size: 34px;
          text-align: center;
        }

        .subtitle {
          margin: 12px 0 30px;
          color: #606060;
          line-height: 1.5;
          text-align: center;
        }

        .field {
          margin-bottom: 20px;
        }

        label {
          display: block;
          margin-bottom: 8px;
          color: #202020;
          font-size: 14px;
          font-weight: 700;
        }

        input {
          width: 100%;
          box-sizing: border-box;
          padding: 13px 14px;
          border: 2px solid #d7d7d7;
          border-radius: 8px;
          color: #202020;
          background: #ffffff;
          font-size: 16px;
          outline: none;
          transition:
            border-color 0.2s,
            box-shadow 0.2s;
        }

        input:focus {
          border-color: #1c1c5b;
          box-shadow: 0 0 0 3px rgba(28, 28, 91, 0.15);
        }

        input:disabled {
          background: #eeeeee;
          cursor: not-allowed;
        }

        .error-message {
          margin: 0 0 18px;
          padding: 11px 13px;
          border-left: 4px solid #b42318;
          border-radius: 5px;
          color: #8f1d14;
          background: #fff0ee;
          font-size: 14px;
        }

        button {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 999px;
          color: #ffffff;
          background: #202020;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          transition:
            background 0.2s,
            transform 0.2s;
        }

        button:hover:not(:disabled) {
          background: #1c1c5b;
          transform: translateY(-1px);
        }

        button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        @media (max-width: 520px) {
          .login-card {
            padding: 30px 22px;
          }

          h1 {
            font-size: 29px;
          }
        }
      `}</style>
    </main>
  );
}