// Quita las propiedades undefined: así un PATCH solo cambia lo que se envió
export function sinIndefinidos<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}