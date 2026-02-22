/**
 * Simple conditional error banner using the hf-banner design system.
 *
 * Renders nothing when `error` is null/undefined/empty.
 *
 * @example
 * ```tsx
 * const [error, setError] = useState<string | null>(null);
 * <ErrorBanner error={error} />
 * ```
 */
export function ErrorBanner({
  error,
  className,
  style,
}: {
  error: string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (!error) return null;
  return (
    <div
      className={`hf-banner hf-banner-error${className ? ` ${className}` : ""}`}
      style={style}
    >
      {error}
    </div>
  );
}
