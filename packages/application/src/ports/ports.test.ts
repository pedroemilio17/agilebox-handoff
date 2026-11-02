import { expectTypeOf, it } from 'vitest'
import type {
  ChangeNotifier,
  Clock,
  ContributorRepository,
  IdGenerator,
  MeetingRepository,
  ParticipationRepository,
  ProjectRepository,
  TaskOpenRepository,
  TaskRepository,
  TeamModuleRepository,
  TeamSettingsRepository,
  TimelineRepository,
  UnitOfWork,
  UserRepository,
} from './index'
import type { OrganizationId, TaskId } from '@agilebox/core'

it('define portas assíncronas e recebe a organização primeiro', () => {
  expectTypeOf<TaskRepository['findById']>().parameter(0).toEqualTypeOf<OrganizationId>()
  expectTypeOf<TaskRepository['findById']>().returns.toMatchTypeOf<Promise<unknown>>()
  expectTypeOf<ProjectRepository['findById']>().parameter(0).toEqualTypeOf<OrganizationId>()
  expectTypeOf<ContributorRepository['findById']>().parameter(0).toEqualTypeOf<OrganizationId>()
  expectTypeOf<ParticipationRepository['findById']>().parameter(0).toEqualTypeOf<OrganizationId>()
  expectTypeOf<TimelineRepository['listByTask']>().parameter(0).toEqualTypeOf<OrganizationId>()
  expectTypeOf<TaskOpenRepository['recordOpen']>().parameter(0).toEqualTypeOf<OrganizationId>()
  expectTypeOf<MeetingRepository['findById']>().parameter(0).toEqualTypeOf<OrganizationId>()
  expectTypeOf<UserRepository['findById']>().parameter(0).toEqualTypeOf<OrganizationId>()
  expectTypeOf<TeamModuleRepository['list']>().parameter(0).toEqualTypeOf<OrganizationId>()
  expectTypeOf<TeamModuleRepository['save']>().parameter(0).toEqualTypeOf<OrganizationId>()
  expectTypeOf<TeamSettingsRepository['find']>().parameter(0).toEqualTypeOf<OrganizationId>()
  expectTypeOf<TeamSettingsRepository['save']>().parameter(0).toEqualTypeOf<OrganizationId>()
  expectTypeOf<UnitOfWork['run']>().returns.toMatchTypeOf<Promise<unknown>>()
  expectTypeOf<Clock['now']>().parameter(0).toEqualTypeOf<OrganizationId>()
  expectTypeOf<Clock['now']>().returns.toEqualTypeOf<Promise<string>>()
  expectTypeOf<IdGenerator['generate']>().parameter(0).toEqualTypeOf<OrganizationId>()
  expectTypeOf<IdGenerator['generate']>().returns.toEqualTypeOf<Promise<string>>()
  expectTypeOf<ChangeNotifier['publish']>().returns.toEqualTypeOf<Promise<void>>()
  expectTypeOf<TaskId>().toMatchTypeOf<string>()
})
