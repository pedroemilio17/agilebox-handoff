import type { OrganizationId } from '@agilebox/core'
import type { IdGenerator } from '../../ports'

const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function encode(value: bigint): string {
  let remaining = value
  let result = ''
  for (let index = 0; index < 26; index += 1) {
    result = alphabet[Number(remaining % 32n)]! + result
    remaining /= 32n
  }
  return result
}

export class SequentialIdGenerator implements IdGenerator {
  private nextValue = 0n

  async generate(_organizationId: OrganizationId): Promise<string> {
    void _organizationId
    await Promise.resolve()
    const id = encode(this.nextValue)
    this.nextValue += 1n
    return id
  }
}
