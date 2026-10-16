export type UnitSystem = 'metric' | 'imperial';

export const KG_PER_LB = 0.45359237;
export const KM_PER_MILE = 1.609344;
export const CM_PER_INCH = 2.54;

export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const cmToIn = (cm: number) => cm / CM_PER_INCH;
export const inToCm = (inch: number) => inch * CM_PER_INCH;
/** Pace in s/km <-> s/mile */
export const secPerKmToSecPerMile = (s: number) => s * KM_PER_MILE;
export const secPerMileToSecPerKm = (s: number) => s / KM_PER_MILE;

export const unitLabels = (u: UnitSystem) =>
    u === 'metric'
        ? { weight: 'kg', height: 'cm', pace: 'min/km' }
        : { weight: 'lb', height: 'in', pace: 'min/mi' };
