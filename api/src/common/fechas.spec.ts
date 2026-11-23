import { diaArgentina, inicioDelDia, rangoDeFechas } from './fechas.js';

describe('fechas en hora argentina (UTC-3)', () => {
  it('el día empieza a las 03:00 UTC', () => {
    expect(inicioDelDia('2026-11-23').toISOString()).toBe('2026-11-23T03:00:00.000Z');
  });

  it('el rango incluye todo el último día', () => {
    const r = rangoDeFechas('2026-11-01', '2026-11-30');
    expect(r.gte.toISOString()).toBe('2026-11-01T03:00:00.000Z');
    expect(r.lt.toISOString()).toBe('2026-12-01T03:00:00.000Z');
  });

  it('una venta a las 23:30 de Argentina cuenta en ese día, aunque en UTC ya sea el siguiente', () => {
    expect(diaArgentina(new Date('2026-11-24T02:30:00Z'))).toBe('2026-11-23');
  });
});
