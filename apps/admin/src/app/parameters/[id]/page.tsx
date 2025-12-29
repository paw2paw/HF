export default function ParameterDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1 style={{ margin: 0 }}>Parameter: {params.id}</h1>
      <p>Stub. Next: show definition, low/high bias, and override editor.</p>
    </div>
  );
}
