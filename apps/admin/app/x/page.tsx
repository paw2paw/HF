import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function XDashboardPage() {
  // Fetch system stats
  const [domainsCount, playbooksCount, callersCount, callsCount, specsCount] =
    await Promise.all([
      prisma.domain.count(),
      prisma.playbook.count(),
      prisma.caller.count(),
      prisma.call.count(),
      prisma.analysisSpec.count(),
    ]);

  const stats = [
    { label: "Domains", value: domainsCount, href: "/playbooks" },
    { label: "Playbooks", value: playbooksCount, href: "/playbooks" },
    { label: "Callers", value: callersCount, href: "/x/callers" },
    { label: "Calls", value: callsCount, href: "/calls" },
    { label: "Specs", value: specsCount, href: "/analysis-specs" },
  ];

  const quickActions = [
    {
      title: "Studio",
      description: "Start a new call or chat session",
      href: "/x/supervisor",
      icon: "🎙️",
    },
    {
      title: "Taxonomy",
      description: "Parameters, variables, and key patterns",
      href: "/x/taxonomy",
      icon: "📊",
    },
    {
      title: "Import Data",
      description: "Import transcripts and generate callers",
      href: "/transcripts",
      icon: "📥",
    },
    {
      title: "Supervisor",
      description: "Monitor and manage active sessions",
      href: "/x/supervisor",
      icon: "👁️",
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          HumanFirst Admin
        </h1>
        <p className="text-gray-600">
          System overview and quick actions
        </p>
      </div>

      {/* System Stats */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          System Stats
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-md transition-all"
            >
              <div className="text-3xl font-bold text-blue-600 mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-gray-600">{stat.label}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-md transition-all group"
            >
              <div className="text-4xl mb-3">{action.icon}</div>
              <div className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                {action.title}
              </div>
              <div className="text-sm text-gray-600">
                {action.description}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
