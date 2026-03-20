import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../api/axios";
import AuthCard from "../components/AuthCard";

const initialState = {
  username: "",
  email: "",
  password: "",
};

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialState);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await api.post("/register", formData);
      navigate("/login", {
        replace: true,
        state: {
          registered: true,
          pendingApproval: true,
          email: formData.email.trim().toLowerCase(),
        },
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "Registration failed. Please review the form and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Create account"
      subtitle="Register first, then wait for approval before entering Baithak."
      form={
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Username</span>
            <input
              name="username"
              type="text"
              placeholder="Choose a username"
              value={formData.username}
              onChange={handleChange}
              autoComplete="username"
              minLength={3}
              required
            />
          </label>

          <label>
            <span>Email</span>
            <input
              name="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              name="password"
              type="password"
              placeholder="Create a password"
              value={formData.password}
              onChange={handleChange}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          <p className="form-success muted">
            New accounts stay pending until an admin approves them.
          </p>

          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Register"}
          </button>
        </form>
      }
      footer={
        <p>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      }
    />
  );
}
