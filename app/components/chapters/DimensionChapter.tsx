import ChapterShell from './ChapterShell';

export default function DimensionChapter({ onBack }: { onBack: () => void }) {
  return (
    <ChapterShell
      title="Dimension"
      manifesto="manifesto text placeholder"
      onBack={onBack}
    />
  );
}
