import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth";
import HeadcountBoard from "./HeadcountBoard";

export default async function HeadcountPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "ADMIN") {
    redirect("/coach");
  }

  return <HeadcountBoard />;
}

  