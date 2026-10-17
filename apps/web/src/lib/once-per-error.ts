export type OncePerError = (error: unknown, action: () => void) => void;

export function oncePerError(): OncePerError {
  let handled: { error: unknown } | null = null;
  return (error, action) => {
    if (handled?.error === error) return;
    handled = { error };
    action();
  };
}
