import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db/database';
import { seedPresetsForChild, seedSubjectsForChild } from '@/lib/db/seed';

const childId = 'test-child-seed';

describe('seedPresetsForChild', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('creates 13 preset medals', async () => {
    await seedPresetsForChild(childId);

    const medals = await db.medalDefinitions
      .where({ child_id: childId })
      .toArray();

    expect(medals).toHaveLength(13);
    expect(medals.every(m => m.is_preset)).toBe(true);
    expect(medals.every(m => m.child_id === childId)).toBe(true);
  });

  it('is idempotent (2nd call is no-op, still 13)', async () => {
    await seedPresetsForChild(childId);
    await seedPresetsForChild(childId);

    const medals = await db.medalDefinitions
      .where({ child_id: childId })
      .toArray();

    expect(medals).toHaveLength(13);
  });
});

describe('seedSubjectsForChild', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('creates 5 default subjects', async () => {
    await seedSubjectsForChild(childId);

    const subjects = await db.subjects
      .where({ child_id: childId })
      .toArray();

    expect(subjects).toHaveLength(5);
    expect(subjects.every(s => s.child_id === childId)).toBe(true);
  });

  it('is idempotent (2nd call is no-op, still 5)', async () => {
    await seedSubjectsForChild(childId);
    await seedSubjectsForChild(childId);

    const subjects = await db.subjects
      .where({ child_id: childId })
      .toArray();

    expect(subjects).toHaveLength(5);
  });
});
