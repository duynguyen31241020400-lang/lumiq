import ErrorBoundary from "@/src/components/ErrorBoundary";

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
