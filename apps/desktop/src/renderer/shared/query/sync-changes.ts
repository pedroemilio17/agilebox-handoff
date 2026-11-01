import type { QueryClient } from '@tanstack/react-query'
import type { AgileBoxApi } from '@agilebox/contract'

type ChangeSubscriber = AgileBoxApi['onChanges']

export function createChangeSync(
  queryClient: Pick<QueryClient, 'invalidateQueries'>,
  subscribe: ChangeSubscriber,
): () => void {
  return subscribe(() => {
    void queryClient.invalidateQueries()
  })
}
