export default async function ParameterDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return (
    <div>
      <h1 style={{ margin: 0 }}>Parameter: {id}</h1>
      <p>Stub. Next: show definition, low/high bias, and override editor.</p>
      <p>
        <a href="/parameters">Back to Parameters</a>
      </p>
    </div>
  );
}
