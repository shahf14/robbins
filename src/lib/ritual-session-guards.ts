export class RitualSessionUncompleteError extends Error {
  constructor() {
    super('Cannot un-complete a ritual session.');
    this.name = 'RitualSessionUncompleteError';
  }
}

/** Reject attempts to mark a completed ritual session as incomplete. */
export function assertRitualNotUncompleted(
  existingCompleted: boolean,
  incomingCompleted: boolean
): void {
  if (existingCompleted && !incomingCompleted) {
    throw new RitualSessionUncompleteError();
  }
}
