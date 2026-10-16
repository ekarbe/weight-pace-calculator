import { formatPace, formatTime } from './utils';

export const MIN_HEALTHY_BMI = 18.5;
export const DEFAULT_TARGET_BMI_FLOOR = 20;
export const DEFAULT_PACE_FACTOR_SEC_PER_KG_PER_KM = 2.0;
const ESSENTIAL_FAT_MALE_WARN_THRESHOLD = 5;
const ESSENTIAL_FAT_FEMALE_WARN_THRESHOLD = 13;
const MIN_PACE_SEC_MALE = 2 * 60 + 40;
const MIN_PACE_SEC_FEMALE = 3 * 60 + 0;
/** Fastest threshold pace (s/km) the model returns for a sex; faster estimates are capped here. */
export const minPaceSecFor = (gender: UserInput['gender']): number => (gender === 'male' ? MIN_PACE_SEC_MALE : MIN_PACE_SEC_FEMALE);


export const RACE_DISTANCES = {
    '5k': 5,
    '10k': 10,
    'hm': 21.0975,
    'm': 42.195
};

export interface UserInput {
    gender: 'male' | 'female' | '';
    heightCm: number;
    weightKg: number;
    bodyFatPercentage: number | null;
    thresholdPaceMin: number;
    thresholdPaceSec: number;
    /** Seconds per km gained per kg lost. Defaults to 2. */
    paceFactorSecPerKg?: number;
    /** Lowest BMI the table runs down to. Defaults to 20. */
    bmiFloor?: number;
}

export interface ResultRow {
    targetWeightKg: number;
    estimatedBodyFatPercentage: number | null;
    estimatedThresholdPaceSec: number | null;
    estimatedThresholdPaceFormatted: string;
    estimated5kTimeSec: number | null;
    estimated5kTimeFormatted: string;
    estimated10kTimeSec: number | null;
    estimated10kTimeFormatted: string;
    estimatedHmTimeSec: number | null;
    estimatedHmTimeFormatted: string;
    estimatedMTimeSec: number | null;
    estimatedMTimeFormatted: string;
    isPotentiallyUnhealthyFat: boolean;
    paceLimited: boolean;
}

export type WarningCode =
    | 'selectGender' | 'invalidHeight' | 'invalidWeight' | 'bodyFatOutOfRange' | 'bodyFatMissing'
    | 'invalidPace' | 'leanMassNonPositive' | 'paceImprovementTooLarge' | 'unhealthyFat' | 'zeroFat'
    | 'paceCapped' | 'belowFloor' | 'disclaimerModel' | 'disclaimerHealth';

/** Locale-free warning; the UI turns `code` + `params` into text (message key `warn.<code>`). */
export interface Warning {
    code: WarningCode;
    params?: Record<string, string | number>;
}

export interface CalculationResults {
    minHealthyWeightKg: number | null;
    resultsTable: ResultRow[];
    warnings: Warning[];
}

export function calculateMinHealthyWeight(heightCm: number, bmi: number = MIN_HEALTHY_BMI): number | null {
    if (!heightCm || heightCm <= 0) return null;
    const heightM = heightCm / 100;
    return bmi * (heightM * heightM);
}

const ANCHORS: [number, number][] = [
    [5, 0.95],
    [10, 0.98],
    [21.0975, 1.04],
    [42.195, 1.10],
];
export const MIN_CUSTOM_DISTANCE_KM = 1;
export const MAX_CUSTOM_DISTANCE_KM = 100;

/** Race pace as a fraction of threshold pace, interpolated on log(distance) between the 5K/10K/HM/M anchors. */
export function racePaceFactor(distanceKm: number): number {
    const d = Math.min(Math.max(distanceKm, MIN_CUSTOM_DISTANCE_KM), MAX_CUSTOM_DISTANCE_KM);
    const x = Math.log(d);
    let lo = ANCHORS[0];
    let hi = ANCHORS[1];
    for (let i = 0; i < ANCHORS.length - 1; i++) {
        lo = ANCHORS[i];
        hi = ANCHORS[i + 1];
        if (x <= Math.log(hi[0])) break;
    }
    const t = (x - Math.log(lo[0])) / (Math.log(hi[0]) - Math.log(lo[0]));
    return Math.min(Math.max(lo[1] + t * (hi[1] - lo[1]), 0.85), 1.25);
}

/** Estimated finishing time in seconds for any distance, given threshold pace in s/km. */
export function estimateRaceTimeSec(thresholdPaceSecPerKm: number, distanceKm: number): number {
    return Math.max(1, thresholdPaceSecPerKm) * racePaceFactor(distanceKm) * distanceKm;
}

/**
 * Inverse of `estimateRaceTimeSec`: the threshold pace (s/km) implied by a race result.
 * Throws a RangeError for a non-positive or non-finite time or distance.
 */
export function thresholdPaceFromRace(timeSec: number, distanceKm: number): number {
    if (!Number.isFinite(timeSec) || !Number.isFinite(distanceKm) || timeSec <= 0 || distanceKm <= 0) {
        throw new RangeError('Race time and distance must be positive numbers.');
    }
    return timeSec / distanceKm / racePaceFactor(distanceKm);
}

function estimateRacePaceFromThreshold(thresholdPaceSecPerKm: number): { [key: string]: number } {
    const safeThresholdPace = Math.max(1, thresholdPaceSecPerKm);
    return {
        '5k': safeThresholdPace * 0.95,
        '10k': safeThresholdPace * 0.98,
        'hm': safeThresholdPace * 1.04,
        'm': safeThresholdPace * 1.10,
    };
}

export function calculateWeightPaceEstimates(input: UserInput): CalculationResults {
    const results: CalculationResults = {
        minHealthyWeightKg: null,
        resultsTable: [],
        warnings: [],
    };

    if (!input.gender) results.warnings.push({ code: 'selectGender' });
    if (!input.heightCm || input.heightCm <= 50) {
        results.warnings.push({ code: 'invalidHeight' });
    }
    if (!input.weightKg || input.weightKg <= 20) results.warnings.push({ code: 'invalidWeight' });

    const bodyFatProvided = input.bodyFatPercentage !== null && input.bodyFatPercentage >= 5 && input.bodyFatPercentage <= 70;
    if (input.bodyFatPercentage !== null && !bodyFatProvided) {
        results.warnings.push({ code: 'bodyFatOutOfRange' });
    }
    if (!bodyFatProvided) {
        results.warnings.push({ code: 'bodyFatMissing' });
    }


    const initialThresholdPaceSec = (input.thresholdPaceMin ?? 0) * 60 + (input.thresholdPaceSec ?? 0);
    const paceInvalid =
        input.thresholdPaceMin == null || input.thresholdPaceMin < 0 ||
        input.thresholdPaceSec == null || input.thresholdPaceSec < 0 || input.thresholdPaceSec >= 60 ||
        initialThresholdPaceSec <= 0;
    if (paceInvalid) {
        results.warnings.push({ code: 'invalidPace' });
    }
    if (paceInvalid || !input.gender || !input.heightCm || input.heightCm <= 50 || !input.weightKg || input.weightKg <= 20) {
        return results;
    }

    const essentialFatLowerBound = input.gender === 'male' ? ESSENTIAL_FAT_MALE_WARN_THRESHOLD : (input.gender === 'female' ? ESSENTIAL_FAT_FEMALE_WARN_THRESHOLD : 0);
    const minPaceSec = input.gender === 'male' ? MIN_PACE_SEC_MALE : (input.gender === 'female' ? MIN_PACE_SEC_FEMALE : MIN_PACE_SEC_FEMALE);

    const bmiFloor = Math.max(MIN_HEALTHY_BMI, input.bmiFloor ?? DEFAULT_TARGET_BMI_FLOOR);
    const paceFactor = input.paceFactorSecPerKg ?? DEFAULT_PACE_FACTOR_SEC_PER_KG_PER_KM;
    results.minHealthyWeightKg = calculateMinHealthyWeight(input.heightCm, bmiFloor);

    let lbmKg: number | null = null;
    if (bodyFatProvided && input.bodyFatPercentage) {
        lbmKg = input.weightKg * (1 - input.bodyFatPercentage / 100);
        if (lbmKg <= 0) {
            results.warnings.push({ code: 'leanMassNonPositive' });
            lbmKg = null;
        }
    }


    let unhealthyFatWarningNeeded = false;
    let paceLimitHitWarningNeeded = false;
    let zeroFatWarningHit = false;

    const startWeight = input.weightKg;
    const endWeightBmi = results.minHealthyWeightKg;
    const absoluteMinWeight = 30;
    const endWeight = endWeightBmi ?? absoluteMinWeight;

    const WEIGHT_STEP_KG = 0.5;
    const stepCount = Math.max(0, Math.ceil((startWeight - endWeight) / WEIGHT_STEP_KG - 1e-9));
    for (let step = 0; step <= stepCount; step++) {
        const targetWeight = Math.max(startWeight - step * WEIGHT_STEP_KG, endWeight);
        if (lbmKg !== null && targetWeight <= lbmKg) {
            zeroFatWarningHit = true;
            break;
        }
        if (targetWeight <= absoluteMinWeight && !endWeightBmi) {
            break;
        }


        const weightDifference = startWeight - targetWeight;

        let estimatedBodyFat: number | null = null;
        let isPotentiallyUnhealthy = false;
        if (lbmKg !== null) {
            estimatedBodyFat = (1 - lbmKg / targetWeight) * 100;
            if (input.gender && estimatedBodyFat < essentialFatLowerBound) {
                isPotentiallyUnhealthy = true;
                unhealthyFatWarningNeeded = true;
            }
        }

        const paceImprovementSec = weightDifference * paceFactor;
        const rawEstimatedPaceSec = initialThresholdPaceSec - paceImprovementSec;

        if (rawEstimatedPaceSec <= 0) {
            results.warnings.push({ code: 'paceImprovementTooLarge' });
            break;
        }

        let paceLimited = false;
        let finalEstimatedPaceSec = rawEstimatedPaceSec;
        if (input.gender && rawEstimatedPaceSec < minPaceSec) {
            finalEstimatedPaceSec = minPaceSec;
            paceLimited = true;
            paceLimitHitWarningNeeded = true;
        }

        const estimatedRacePaces = estimateRacePaceFromThreshold(finalEstimatedPaceSec);
        const estimated5kTimeSec = estimatedRacePaces['5k'] * RACE_DISTANCES['5k'];
        const estimated10kTimeSec = estimatedRacePaces['10k'] * RACE_DISTANCES['10k'];
        const estimatedHmTimeSec = estimatedRacePaces['hm'] * RACE_DISTANCES['hm'];
        const estimatedMTimeSec = estimatedRacePaces['m'] * RACE_DISTANCES['m'];

        results.resultsTable.push({
            targetWeightKg: parseFloat(targetWeight.toFixed(1)),
            estimatedBodyFatPercentage: estimatedBodyFat !== null ? parseFloat(estimatedBodyFat.toFixed(1)) : null,
            estimatedThresholdPaceSec: finalEstimatedPaceSec,
            estimatedThresholdPaceFormatted: formatPace(finalEstimatedPaceSec),
            estimated5kTimeSec: estimated5kTimeSec,
            estimated5kTimeFormatted: formatTime(estimated5kTimeSec),
            estimated10kTimeSec: estimated10kTimeSec,
            estimated10kTimeFormatted: formatTime(estimated10kTimeSec),
            estimatedHmTimeSec: estimatedHmTimeSec,
            estimatedHmTimeFormatted: formatTime(estimatedHmTimeSec),
            estimatedMTimeSec: estimatedMTimeSec,
            estimatedMTimeFormatted: formatTime(estimatedMTimeSec),
            isPotentiallyUnhealthyFat: isPotentiallyUnhealthy,
            paceLimited: paceLimited,
        });

        if (targetWeight <= endWeight) break;
    }

    if (unhealthyFatWarningNeeded) {
        results.warnings.push({ code: 'unhealthyFat', params: { threshold: essentialFatLowerBound, sex: input.gender } });
    }
    if (zeroFatWarningHit) {
        results.warnings.push({ code: 'zeroFat' });
    }
    if (paceLimitHitWarningNeeded) {
        results.warnings.push({ code: 'paceCapped', params: { pace: formatPace(minPaceSec), sex: input.gender } });
    }
    if (results.minHealthyWeightKg && input.weightKg <= results.minHealthyWeightKg) {
        results.warnings.push({ code: 'belowFloor', params: { bmi: bmiFloor } });
    }
    results.warnings.push({ code: 'disclaimerModel', params: { factor: paceFactor } });
    results.warnings.push({ code: 'disclaimerHealth' });


    return results;
}