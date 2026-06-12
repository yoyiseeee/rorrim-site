import ChapterShell from './ChapterShell';

export default function AlphabetChapter({ onBack }: { onBack: () => void }) {
  return (
    <ChapterShell
      title="Alphabet"
      manifesto="manifesto text placeholder"
      onBack={onBack}
    />
  );
}
