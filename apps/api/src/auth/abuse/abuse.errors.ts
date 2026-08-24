export class WorkspaceSuspendedError extends Error {
  constructor(readonly reason: string | null) {
    super(
      reason
        ? `This workspace is suspended: ${reason}. Existing data stays readable and exportable, and billing remains open.`
        : 'This workspace is suspended. Existing data stays readable and exportable, and billing remains open.',
    );
    this.name = 'WorkspaceSuspendedError';
  }
}
