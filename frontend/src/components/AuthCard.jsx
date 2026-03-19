export default function AuthCard({ title, subtitle, form, footer }) {
  return (
    <div className="auth-layout">
      <section className="auth-hero">
        <p className="eyebrow">Day 2</p>
        <h1>ChatApp</h1>
        <p className="hero-copy">
          A focused auth shell for the messaging app. Register, sign in, and
          move straight into the protected chat flow.
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
