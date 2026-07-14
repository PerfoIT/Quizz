import type { PublicAnswer } from "../lib/types";

const tones = [
  "border-blue-400/40 bg-blue-500/15",
  "border-cyan-300/40 bg-cyan-400/15",
  "border-indigo-300/40 bg-indigo-400/15",
  "border-sky-300/40 bg-sky-400/15"
];

type Props = {
  answers: PublicAnswer[];
  selected?: number | null;
  correctAnswerOrder?: number;
  onSelect?: (order: number) => void;
  disabled?: boolean;
};

export function AnswerGrid({ answers, selected, correctAnswerOrder, onSelect, disabled }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {answers.map((answer, index) => {
        const isSelected = selected === answer.order;
        const isCorrect = correctAnswerOrder === answer.order;
        return (
          <button
            key={answer.order}
            type="button"
            disabled={disabled}
            onClick={() => onSelect?.(answer.order)}
            className={`min-h-24 rounded-lg border p-5 text-left text-lg font-semibold transition duration-200 ${
              tones[index % tones.length]
            } ${isSelected ? "ring-2 ring-white" : ""} ${isCorrect ? "border-emerald-300 bg-emerald-400/25" : ""} ${
              disabled ? "cursor-default" : "hover:-translate-y-0.5 hover:bg-white/15"
            }`}
          >
            {answer.imageUrl && (
              <img src={answer.imageUrl} alt="" className="mb-4 aspect-video w-full rounded-md object-cover" />
            )}
            <span className="mr-3 font-mono text-sm text-slate-300">{answer.order}</span>
            <span>{answer.text}</span>
          </button>
        );
      })}
    </div>
  );
}
