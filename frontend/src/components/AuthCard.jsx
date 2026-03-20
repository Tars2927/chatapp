export default function AuthCard({ title, subtitle, form, footer }) {
  return (
    <div className="auth-layout">
      <section className="auth-hero">
        <div className="brand-lockup hero">
          <img className="brand-logo hero" src="/baithak-logo.svg" alt="Baithak logo" />
          <div>
            <h1>Baithak</h1>
          </div>
        </div>
        <p className="hero-copy">
          A focused auth shell for the messaging app. Register, sign in, and
          move straight into the protected Baithak flow.
        </p>
      </section>

      <section className="auth-card">
        <div className="auth-card-header">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>

        {form}

        <div className="auth-footer">{footer}</div>
      </section>
    </div>
  );
}
