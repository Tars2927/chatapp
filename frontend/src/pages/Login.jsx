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

  const registeredEmail = location.state?.email || "";
  const registrationSuccess = Boolean(location.state?.registered);

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
          "Login failed. Check your credentials and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to continue into the protected chat workspace."
      form={
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              name="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email || registeredEmail}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              name="password"
              type="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          {registrationSuccess ? (
            <p className="form-success">
              Account created. Sign in with {registeredEmail || "your new email"}.
            </p>
          ) : null}

          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Login"}
          </button>
        </form>
      }
      footer={
        <p>
          Need an account? <Link to="/register">Create one</Link>
        </p>
      }
    />
  );
}
