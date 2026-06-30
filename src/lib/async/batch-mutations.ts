/** Run mutations in parallel, always call `after`, then throw the first rejection if any failed. */
export async function settleAllThen(
  tasks: Promise<unknown>[],
  after: () => Promise<void>
): Promise<void> {
  const results = await Promise.allSettled(tasks);
  await after();
  const rejected = results.find((result) => result.status === 'rejected');
  if (rejected?.status === 'rejected') {
    throw rejected.reason;
  }
}
