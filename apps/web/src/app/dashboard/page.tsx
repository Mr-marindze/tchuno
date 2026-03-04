import DashboardClient from "./dashboard-client";
import { requireServerSession } from "@/lib/server-auth";

export default async function DashboardPage() {
  const session = await requireServerSession();

  return (
    <DashboardClient initialAuth={session.auth} initialMe={session.me} />
  );
}
