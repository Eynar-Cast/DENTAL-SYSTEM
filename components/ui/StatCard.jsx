"use client";

export default function StatCard({ icon, label, value, accent = "teal", sub }) {
  return (
    <div className="card hover-lift stat-card">
      <div className={`stat-icon stat-accent-${accent}`}>{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-faint)" }}>{sub}</div>}
    </div>
  );
}