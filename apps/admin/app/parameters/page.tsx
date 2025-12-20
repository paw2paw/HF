import { prisma } from "@/lib/prisma";

async function toggleActive(parameterId: string) {
  "use server";
  const p = await prisma.parameter.findUnique({ where: { parameterId } });
  if (!p) return;
  await prisma.parameter.update({
    where: { parameterId },
    data: { isActive: !p.isActive },
  });
}

async function toggleMvp(parameterId: string) {
  "use server";
  const p = await prisma.parameter.findUnique({ where: { parameterId } });
  if (!p) return;
  await prisma.parameter.update({
    where: { parameterId },
    data: { isMvpCore: !p.isMvpCore },
  });
}

export default async function ParametersPage() {
  const parameters = await prisma.parameter.findMany({
    orderBy: [{ sectionId: "asc" }, { parameterId: "asc" }],
  });

  return (
    <main style={{ padding: 24 }}>
      <h1>HF — Conversation Parameters</h1>
      <p>Total parameters: {parameters.length}</p>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Section", "ID", "Name", "Domain", "MVP", "Active"].map(h => (
              <th
                key={h}
                style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parameters.map(p => (
            <tr key={p.parameterId}>
              <td style={{ padding: 8 }}>{p.sectionId}</td>
              <td style={{ padding: 8, fontFamily: "monospace" }}>{p.parameterId}</td>
              <td style={{ padding: 8 }}>{p.name}</td>
              <td style={{ padding: 8 }}>{p.domainGroup}</td>

              <td style={{ padding: 8 }}>
                <form action={async () => toggleMvp(p.parameterId)}>
                  <button type="submit">
                    {p.isMvpCore ? "✓ MVP" : "Set MVP"}
                  </button>
                </form>
              </td>

              <td style={{ padding: 8 }}>
                <form action={async () => toggleActive(p.parameterId)}>
                  <button type="submit">
                    {p.isActive ? "✓ Active" : "Enable"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}