import { redirect } from "next/navigation";

import AdminNav from "@/components/AdminNav";
import { getCurrentSession } from "@/lib/auth";

export default async function AttendancePage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "ADMIN") {
    redirect("/coach");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        fontFamily: "system-ui",
        background: "#0b0b0f",
        color: "#eaeaf0",
      }}
    >
      <h1 style={{ fontSize: 30, marginBottom: 8 }}>
        Attendance
      </h1>

      <p
        style={{
          color: "#a1a1aa",
          marginTop: 0,
          marginBottom: 18,
        }}
      >
        Monitor expected attendance, check-ins, and walk-ins.
      </p>

      <AdminNav />

      <section
        style={{
          border: "1px solid #2a2a33",
          borderRadius: 14,
          padding: 18,
          background: "#0f0f16",
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          Attendance Management
        </h2>

        <p
          style={{
            color: "#a1a1aa",
            marginBottom: 0,
          }}
        >
          Coach check-ins, QR check-in, walk-ins, and attendance summaries will
          live on this page.
        </p>
      </section>
    </main>
  );
}