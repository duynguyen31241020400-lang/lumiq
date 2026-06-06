function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "vừa xong";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}p trước`;
  const hours = Math.floor(minutes / 60);
  return `${hours}g trước`;
}

interface UserQuestionBubbleProps {
  question: string;
  timestamp: number;
}

export default function UserQuestionBubble({
  question,
  timestamp,
}: UserQuestionBubbleProps) {
  return (
    <div className="lumiq-fade-in ml-auto max-w-[90%]">
      <div className="rounded-md border-[0.5px] border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2.5">
        <p className="font-sans text-[12px] leading-[1.6] text-[#ccc]">
          {question}
        </p>
        <p className="mt-1.5 text-right font-mono text-[10px] text-[#444]">
          {formatRelativeTime(timestamp)}
        </p>
      </div>
    </div>
  );
}
