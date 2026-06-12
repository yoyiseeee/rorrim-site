type ChapterShellProps = {
  title: string;
  manifesto: string;
  onBack: () => void;
};

export default function ChapterShell({ title, manifesto, onBack }: ChapterShellProps) {
  return (
    <section className="chapter-shell">
      <button className="chapter-back" onClick={onBack}>
        home
      </button>
      <h1>{title}</h1>
      <div className="chapter-mirror" aria-label={`${title} mirror area`} />
      <p>{manifesto}</p>
    </section>
  );
}
