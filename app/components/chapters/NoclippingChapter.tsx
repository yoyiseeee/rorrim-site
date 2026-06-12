import ChapterShell from './ChapterShell';

export default function NoclippingChapter({ onBack }: { onBack: () => void }) {
  return (
    <ChapterShell
      title="Noclipping"
      manifesto="manifesto text placeholder"
      onBack={onBack}
    />
  );
}
