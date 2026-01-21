export default function SessionDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1 style={{ margin: 0 }}>Session: {params.id}</h1>
      <p>Stub. Next: snapshot view + prompt timeline + events log.</p>
    </div>
  );
}
