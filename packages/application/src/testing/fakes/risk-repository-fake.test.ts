import { describeRiskRepositoryContract } from '../risk-repository-contract'
import {
  InMemoryDeliverableRepository,
  InMemoryProjectRepository,
  InMemoryRiskRepository,
  InMemoryUserRepository,
  createInMemoryState,
} from './in-memory-repositories'

const makeAdapters = () => {
  const state = createInMemoryState()
  return {
    projects: new InMemoryProjectRepository(state),
    users: new InMemoryUserRepository(state),
    deliverables: new InMemoryDeliverableRepository(state),
    risks: new InMemoryRiskRepository(state),
  }
}

describeRiskRepositoryContract('repositório em memória', makeAdapters)
