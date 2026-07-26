import { redirect } from "next/navigation";

import AdminNav from "@/components/AdminNav";
import { getCurrentSession } from "@/lib/auth";
import RegistrationsBoard from "./RegistrationsBoard";

export default async function RegistrationsPage() {
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
        Registrations
      </h1>

      <p
        style={{
          color: "#a1a1aa",
          marginTop: 0,
          marginBottom: 18,
        }}
      >
        Create clinic series and manage registration periods.
      </p>

      <AdminNav />

      <RegistrationsBoard />
    </main>
  );
}