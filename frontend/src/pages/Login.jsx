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
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [verificationSuccess, setVerificationSuccess] = useState("");
  const [showVerificationPanel, setShowVerificationPanel] = useState(
    Boolean(location.state?.verificationRequired),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResendingCode, setIsResendingCode] = useState(false);

  const registeredEmail = location.state?.email || "";
  const registrationSuccess = Boolean(location.state?.registered);
  const pendingApproval = Boolean(location.state?.pendingApproval);
  const verificationRequired = Boolean(location.state?.verificationRequired);

  function getErrorDetail(requestError) {
    return requestError.response?.data?.detail;
  }

  function getErrorCode(requestError) {
    const detail = getErrorDetail(requestError);
    return typeof detail === "object" && detail ? detail.code : "";
  }

  function getErrorMessage(requestError, fallbackMessage) {
    const detail = getErrorDetail(requestError);
    if (typeof detail === "string") {
      return detail;
    }
    return detail?.message || fallbackMessage;
  }

  function readActiveEmail() {
    return (formData.email || registeredEmail).trim().toLowerCase();
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setVerificationError("");
    setVerificationSuccess("");
    setIsSubmitting(true);

    const payload = {
      ...formData,
      email: readActiveEmail(),
    };

    try {
      const response = await api.post("/login", payload);
      localStorage.setItem("token", response.data.access_token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      navigate("/chat", { replace: true });
    } catch (requestError) {
      const nextMessage = getErrorMessage(
        requestError,
        "Login failed. Check your credentials and try again.",
      );

      if (getErrorCode(requestError) === "email_not_verified") {
        setShowVerificationPanel(true);
        setVerificationError(nextMessage);
      } else {
        setError(nextMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp() {
    const email = readActiveEmail();

    if (!email) {
      setVerificationError("Enter your email address before verifying the OTP.");
      return;
    }

    setError("");
    setVerificationError("");
    setVerificationSuccess("");
    setIsVerifying(true);

    try {
      const response = await api.post("/verify-email-otp", {
        email,
        otp: otpCode.trim(),
      });

      setOtpCode("");
      setShowVerificationPanel(false);
      setVerificationSuccess(
        response.data.pending_approval
          ? "Email verified. Your account is now waiting for admin approval."
          : "Email verified. You can log in now.",
      );
    } catch (requestError) {
      setVerificationError(
        getErrorMessage(requestError, "Could not verify that OTP right now."),
      );
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResendOtp() {
    const email = readActiveEmail();

    if (!email) {
      setVerificationError("Enter your email address before requesting a new OTP.");
      return;
    }

    setError("");
    setVerificationError("");
    setVerificationSuccess("");
    setIsResendingCode(true);

    try {
      await api.post("/resend-email-otp", { email });
      setShowVerificationPanel(true);
      setVerificationSuccess(`A fresh verification code was sent to ${email}.`);
    } catch (requestError) {
      setVerificationError(
        getErrorMessage(requestError, "Could not resend the verification code."),
      );
    } finally {
      setIsResendingCode(false);
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
            <p>Use your verified, approved email and password to enter the workspace.</p>
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
                  {verificationRequired
                    ? `Account created for ${registeredEmail || "your email"}. Verify the OTP from your inbox${pendingApproval ? ", then wait for admin approval." : " before signing in."}`
                    : pendingApproval
                      ? `Account created for ${registeredEmail || "your email"}. Waiting for admin approval.`
                      : `Account created. Sign in with ${registeredEmail || "your new email"}.`}
                </span>
              </div>
            )}

            {verificationSuccess && (
              <div className="login-status login-status-success">
                <span>{verificationSuccess}</span>
              </div>
            )}

            {showVerificationPanel && (
              <div className="login-verification-panel">
                <p className="login-help-copy">
                  Enter the 6-digit OTP sent to <strong>{readActiveEmail() || "your email"}</strong>.
                </p>

                <label className="login-field-premium">
                  <span>Email verification code</span>
                  <input
                    className="login-input-premium"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value)}
                    autoComplete="one-time-code"
                    maxLength={6}
                  />
                </label>

                {verificationError && (
                  <div className="login-status login-status-error">
                    <span>{verificationError}</span>
                  </div>
                )}

                <div className="login-inline-actions">
                  <button
                    type="button"
                    className="login-submit-premium"
                    onClick={handleVerifyOtp}
                    disabled={isVerifying || isResendingCode}
                  >
                    {isVerifying ? "Verifying..." : "Verify OTP"}
                  </button>

                  <button
                    type="button"
                    className="secondary-button login-secondary-button"
                    onClick={handleResendOtp}
                    disabled={isVerifying || isResendingCode}
                  >
                    {isResendingCode ? "Sending..." : "Resend code"}
                  </button>
                </div>
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
            <span>OTP-verified email</span>
            <span>Admin-approved accounts</span>
          </div>
        </div>
      </section>
    </main>
  );
}
