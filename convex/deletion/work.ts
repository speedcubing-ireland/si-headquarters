const IO_BATCH_SIZE = 100

async function mapInBatches<Input, Output>(
  values: readonly Input[],
  batchSize: number,
  map: (value: Input) => Promise<Output>
): Promise<Output[]> {
  const results: Output[] = []
  for (let index = 0; index < values.length; index += batchSize) {
    results.push(
      ...(await Promise.all(values.slice(index, index + batchSize).map(map)))
    )
  }
  return results
}

export async function runDeletionWork<Input>(
  values: readonly Input[],
  run: (value: Input) => Promise<void>
): Promise<void> {
  await mapInBatches(values, IO_BATCH_SIZE, run)
}
