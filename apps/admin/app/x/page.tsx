import { auth } from "@/lib/auth";
import SuperadminDashboard from "./_dashboards/SuperadminDashboard";
import AdminDashboard from "./_dashboards/AdminDashboard";
import TesterDashboard from "./_dashboards/TesterDashboard";
import DemoDashboard from "./_dashboards/DemoDashboard";

export default async function XDashboardPage() {
  const session = await auth();
  const role = session?.user?.role;

  switch (role) {
    case "SUPERADMIN":
      return <SuperadminDashboard />;
    case "ADMIN":
      return <AdminDashboard />;
    case "SUPER_TESTER":
      return <TesterDashboard enhanced />;
    case "TESTER":
    case "VIEWER": // @deprecated alias
      return <TesterDashboard />;
    case "DEMO":
      return <DemoDashboard />;
    case "OPERATOR":
    default:
      return <AdminDashboard />;
  }
}
