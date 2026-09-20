export function PageHeader({
  title,
  titleTh,
  description,
}: {
  title: string;
  titleTh?: string;
  description?: string;
}) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {titleTh ? (
        <p className="text-sm text-muted" lang="th">
          {titleTh}
        </p>
      ) : null}
      {description ? <p className="mt-2 text-sm text-muted">{description}</p> : null}
    </header>
  );
}
