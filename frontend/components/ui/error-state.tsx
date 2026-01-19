interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <div className="text-center py-12 px-4">
      <div className="text-4xl mb-4">⚠️</div>
      <h3 className="text-lg font-semibold text-neutral-900 mb-2">{title}</h3>
      {message && <p className="text-neutral-600 mb-6 max-w-md mx-auto">{message}</p>}
      {onRetry && (
        <button onClick={onRetry} className="btn btn-primary">
          Try again
        </button>
      )}
    </div>
  );
}
