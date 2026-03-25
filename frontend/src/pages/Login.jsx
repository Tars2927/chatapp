import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";

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
    <main className="login-shell">
      <section className="login-showcase" aria-hidden="true">
        <div className="login-showcase-frame">
          <div className="login-showcase-mark">
            <img src="/baithak-logo.svg" alt="" />
          </div>
          <div className="login-showcase-ornament">
            <div className="login-showcase-ornament-ring" />
            <div className="login-showcase-ornament-core">
              <img src="/baithak-logo.svg" alt="" />
            </div>
          </div>
          <div className="login-showcase-copy">
            <p className="login-showcase-kicker">Private group space</p>
            <h1>Baithak</h1>
            <p>
              Quietly gather, sign in, and step into a cleaner, more focused
              conversation room.
            </p>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-panel-inner">
          <div className="login-brand">baithak</div>

          <div className="login-intro">
            <h2>Login to your account</h2>
            <p>Use your approved email and password to enter the workspace.</p>
          </div>

          <form className="login-form-premium" onSubmit={handleSubmit}>
            <label className="login-field-premium">
              <span>Email address</span>
              <input
                className="login-input-premium"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email || registeredEmail}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </label>

            <label className="login-field-premium">
              <span>Password</span>
              <input
                className="login-input-premium"
                name="password"
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password"
                required
              />
            </label>

            {error && (
              <div className="login-status login-status-error">
                <span>{error}</span>
              </div>
            )}

            {registrationSuccess && (
              <div className="login-status login-status-success">
                <span>
                  {pendingApproval
                    ? `Account created for ${registeredEmail || "your email"}. Waiting for admin approval.`
                    : `Account created. Sign in with ${registeredEmail || "your new email"}.`}
                </span>
              </div>
            )}

            <button
              type="submit"
              className="login-submit-premium"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in..." : "Continue"}
            </button>
          </form>

          <p className="login-register-link">
            Don&apos;t have an account? <Link to="/register">Create one</Link>
          </p>

          <div className="login-meta-links">
            <span>Protected access</span>
            <span>Admin-approved accounts</span>
          </div>
        </div>
      </section>
    </main>
  );
}
