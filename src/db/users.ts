import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  role: 'teacher' | 'student' = 'teacher',
  linkedCode?: string | null
) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        role,
        ...(linkedCode ? { linkedCode } : {}),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          role,
          ...(linkedCode ? { linkedCode } : {}),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}
