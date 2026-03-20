import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";
import AuthCard from "../components/AuthCard";

const initialState = {
  email: "",
  password: "",
};

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialState);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const registeredEmail = location.state?.email || "";
  const registrationSuccess = Boolean(location.state?.registered);
  const pendingApproval = Boolean(location.state?.pendingApproval);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const payload = {
      ...formData,
      email: (formData.email || registeredEmail).trim(),
    };

    try {
      const response = await api.post("/login", payload);
      localStorage.setItem("token", response.data.access_token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      navigate("/chat", { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "Login failed. Check your credentials and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&family=DM+Sans:wght@300;400;500&display=swap');

        :root {
          --glass-bg: rgba(253, 248, 253, 0.72);
          --glass-border: rgba(222, 193, 175, 0.15);
          --glass-shadow: rgba(28, 27, 31, 0.06);
          --accent: #954a00;
          --accent-strong: #ff8717;
          --accent-soft: rgba(255, 183, 132, 0.28);
          --secondary-accent: #465c97;
          --text-primary: rgba(28, 27, 31, 0.92);
          --text-secondary: rgba(87, 67, 53, 0.72);
          --error: #93000a;
          --success: #245b34;
          --input-bg: rgba(248, 242, 248, 0.95);
          --input-focus-bg: rgba(255, 255, 255, 0.88);
          --input-border: rgba(222, 193, 175, 0.15);
          --input-focus-border: rgba(149, 74, 0, 0.55);
        }

        .login-form-inner {
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .login-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
          position: relative;
        }

        .login-field-label {
          font-family: 'Sora', sans-serif;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-secondary);
          transition: color 0.2s ease;
        }

        .login-field.focused .login-field-label {
          color: var(--accent);
        }

        .login-input-wrapper {
          position: relative;
        }

        .login-input {
          width: 100%;
          box-sizing: border-box;
          background: var(--input-bg);
          border: none;
          border-bottom: 1px solid var(--input-border);
          border-radius: 12px;
          padding: 13px 16px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14.5px;
          font-weight: 400;
          color: var(--text-primary);
          outline: none;
          transition: all 0.25s ease;
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }

        .login-input::placeholder {
          color: rgba(87, 67, 53, 0.42);
        }

        .login-input:focus {
          background: var(--input-focus-bg);
          border-bottom-color: var(--input-focus-border);
          box-shadow:
            0 10px 20px -20px rgba(149, 74, 0, 0.7),
            inset 0 1px 0 rgba(255, 255, 255, 0.16);
        }

        .login-input:hover:not(:focus) {
          border-bottom-color: rgba(149, 74, 0, 0.22);
          background: rgba(255, 255, 255, 0.72);
        }

        .login-submit-btn {
          margin-top: 6px;
          width: 100%;
          padding: 14px;
          border-radius: 14px;
          border: 1px solid rgba(222, 193, 175, 0.12);
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
          color: var(--text-primary);
          font-family: 'Sora', sans-serif;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: all 0.25s ease;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          position: relative;
          overflow: hidden;
        }

        .login-submit-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 60%);
          opacity: 0;
          transition: opacity 0.25s ease;
        }

        .login-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #a55200, #ff9635);
          border-color: rgba(222, 193, 175, 0.18);
          box-shadow:
            0 12px 32px rgba(149, 74, 0, 0.22),
            0 4px 15px rgba(28, 27, 31, 0.08);
          transform: translateY(-1px);
        }

        .login-submit-btn:hover:not(:disabled)::before {
          opacity: 1;
        }

        .login-submit-btn:active:not(:disabled) {
          transform: translateY(0px);
          box-shadow: none;
        }

        .login-submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .login-submit-btn .btn-spinner {
          display: inline-block;
          width: 13px;
          height: 13px;
          border: 2px solid rgba(255,255,255,0.32);
          border-top-color: rgba(255,255,255,0.92);
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          margin-right: 8px;
          vertical-align: middle;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .login-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 11px 14px;
          border-radius: 10px;
          background: rgba(255, 218, 214, 0.95);
          border: 1px solid rgba(222, 193, 175, 0.15);
          color: var(--error);
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          animation: fadeSlideIn 0.25s ease;
        }

        .login-success {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 11px 14px;
          border-radius: 10px;
          background: rgba(223, 246, 228, 0.95);
          border: 1px solid rgba(222, 193, 175, 0.15);
          color: var(--success);
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          line-height: 1.5;
          animation: fadeSlideIn 0.25s ease;
        }

        .login-footer-link {
          text-align: center;
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px;
          color: var(--text-secondary);
        }

        .login-footer-link a {
          color: var(--accent);
          text-decoration: none;
          font-weight: 500;
          transition: opacity 0.2s;
        }

        .login-footer-link a:hover {
          opacity: 0.75;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 640px) {
          .login-form-inner {
            gap: 16px;
          }

          .login-field {
            gap: 6px;
          }

          .login-field-label {
            font-size: 10px;
            letter-spacing: 0.1em;
          }

          .login-input {
            padding: 12px 14px;
            font-size: 16px;
            border-radius: 11px;
          }

          .login-submit-btn {
            padding: 13px;
            border-radius: 12px;
            font-size: 13.5px;
          }

          .login-error,
          .login-success {
            padding: 10px 12px;
            border-radius: 9px;
            font-size: 12.5px;
          }

          .login-footer-link {
            font-size: 13px;
          }
        }
      `}</style>

      <AuthCard
        title="Welcome back"
        subtitle="Sign in to continue into the protected Baithak workspace."
        form={
          <form className="login-form-inner" onSubmit={handleSubmit}>

            <div className={`login-field ${focusedField === "email" ? "focused" : ""}`}>
              <span className="login-field-label">Email</span>
              <div className="login-input-wrapper">
                <input
                  className="login-input"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email || registeredEmail}
                  onChange={handleChange}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className={`login-field ${focusedField === "password" ? "focused" : ""}`}>
              <span className="login-field-label">Password</span>
              <div className="login-input-wrapper">
                <input
                  className="login-input"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="login-error">
                <span>⚠</span>
                <span>{error}</span>
              </div>
            )}

            {registrationSuccess && (
              <div className="login-success">
                <span>✓</span>
                <span>
                  {pendingApproval
                    ? `Account created for ${registeredEmail || "your email"}. Waiting for admin approval.`
                    : `Account created. Sign in with ${registeredEmail || "your new email"}.`}
                </span>
              </div>
            )}

            <button type="submit" className="login-submit-btn" disabled={isSubmitting}>
              {isSubmitting && <span className="btn-spinner" />}
              {isSubmitting ? "Signing in..." : "Login"}
            </button>
          </form>
        }
        footer={
          <p className="login-footer-link">
            Need an account? <Link to="/register">Create one</Link>
          </p>
        }
      />
    </>
  );
}
