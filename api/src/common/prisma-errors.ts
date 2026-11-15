import { Prisma } from '../generated/prisma/client.js';

// true si el error es por violar un @unique / @@unique
export function esErrorUnico(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}