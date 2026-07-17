interface ValidationPanelProps {
  errors: Array<{ message: string }>;
}

export function ValidationPanel({ errors }: ValidationPanelProps) {
  if (errors.length > 0) {
    return (
      <section className="panel errors">
        <h2>Validation</h2>
        <ul>
          {errors.map((error, index) => (
            <li key={index}>{error.message}</li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="panel ok">
      <h2>Validation</h2>
      <p>No issues — this build is legal.</p>
    </section>
  );
}
