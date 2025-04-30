import { formatPace, formatTime } from './utils';

const MIN_HEALTHY_BMI = 18.5;
const PACE_IMPROVEMENT_FACTOR_SEC_PER_KG_PER_KM = 2.0;
const ESSENTIAL_FAT_MALE_WARN_THRESHOLD = 5;
const ESSENTIAL_FAT_FEMALE_WARN_THRESHOLD = 13;
const MIN_PACE_SEC_MALE = 2 * 60 + 40;
const MIN_PACE_SEC_FEMALE = 3 * 60 + 0;


const RACE_DISTANCES = {
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

export interface CalculationResults {
    minHealthyWeightKg: number | null;
    resultsTable: ResultRow[];
    warnings: string[];
}

export function calculateMinHealthyWeight(heightCm: number): number | null {
    if (!heightCm || heightCm <= 0) return null;
    const heightM = heightCm / 100;
    return MIN_HEALTHY_BMI * (heightM * heightM);
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

    if (!input.gender) results.warnings.push("Please select a biological gender.");
    if (!input.heightCm || input.heightCm <= 50) {
        results.warnings.push("Please enter a valid height in cm (>50). Height is required to estimate a minimum healthy weight based on BMI.");
    }
    if (!input.weightKg || input.weightKg <= 20) results.warnings.push("Please enter a valid weight in kg (>20).");

    const bodyFatProvided = input.bodyFatPercentage !== null && input.bodyFatPercentage >= 5 && input.bodyFatPercentage <= 70;
    if (input.bodyFatPercentage !== null && !bodyFatProvided) {
        results.warnings.push("Body Fat Percentage provided is outside the typical range (5-70%). Calculations requiring it will be skipped.");
    }
    if (!bodyFatProvided) {
        results.warnings.push("Body Fat Percentage not provided or invalid. Body fat estimations and related warnings are unavailable. The minimum healthy weight is based solely on BMI.");
    }


    const initialThresholdPaceSec = (input.thresholdPaceMin ?? 0) * 60 + (input.thresholdPaceSec ?? 0);
    if (input.thresholdPaceMin === null || input.thresholdPaceMin < 0 || input.thresholdPaceSec === null || input.thresholdPaceSec < 0 || input.thresholdPaceSec >= 60 || initialThresholdPaceSec <= 0) {
        results.warnings.push("Please enter a valid threshold pace greater than 0:00 min/km.");
        if (results.warnings.length > 1 || !input.weightKg || !input.heightCm || initialThresholdPaceSec <= 0) {
            return results;
        }
    }

    const essentialFatLowerBound = input.gender === 'male' ? ESSENTIAL_FAT_MALE_WARN_THRESHOLD : (input.gender === 'female' ? ESSENTIAL_FAT_FEMALE_WARN_THRESHOLD : 0);
    const minPaceSec = input.gender === 'male' ? MIN_PACE_SEC_MALE : (input.gender === 'female' ? MIN_PACE_SEC_FEMALE : MIN_PACE_SEC_FEMALE);

    results.minHealthyWeightKg = input.heightCm ? calculateMinHealthyWeight(input.heightCm) : null;

    let lbmKg: number | null = null;
    if (bodyFatProvided && input.bodyFatPercentage) {
        lbmKg = input.weightKg * (1 - input.bodyFatPercentage / 100);
        if (lbmKg <= 0) {
            results.warnings.push("Calculated Lean Body Mass is zero or negative. Body fat estimations will be skipped.");
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

    for (let currentWeight = startWeight; currentWeight >= endWeight; currentWeight -= 0.5) {
        const targetWeight = Math.max(currentWeight, endWeight);
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

        const paceImprovementSec = weightDifference * PACE_IMPROVEMENT_FACTOR_SEC_PER_KG_PER_KM;
        const rawEstimatedPaceSec = initialThresholdPaceSec - paceImprovementSec;

        if (rawEstimatedPaceSec <= 0) {
            if (!results.warnings.some(w => w.includes("pace estimate reached zero"))) {
                results.warnings.push("Warning: Estimated pace improvement is very large, leading to unrealistic raw pace estimates (<= 0:00 min/km). Rows beyond this point are not generated.");
            }
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
        results.warnings.push(`Highlighted rows indicate estimated body fat below potentially healthy levels (${input.gender === 'male' ? ESSENTIAL_FAT_MALE_WARN_THRESHOLD : ESSENTIAL_FAT_FEMALE_WARN_THRESHOLD}% for ${input.gender}). Reaching such low body fat can have health risks. Consult a healthcare professional.`);
    }
    if (zeroFatWarningHit) {
        results.warnings.push("Warning: Calculations stopped as target weight reached the estimated Lean Body Mass (approx. 0% body fat), which is physically impossible.");
    }
    if (paceLimitHitWarningNeeded) {
        results.warnings.push(`Estimated threshold pace has been capped at the minimum defined limit (${formatPace(minPaceSec)} min/km for ${input.gender}) for some weights.`);
    }
    if (results.minHealthyWeightKg && input.weightKg <= results.minHealthyWeightKg) {
        results.warnings.push("Your current weight is already at or below the calculated minimum healthy weight (BMI 18.5). Further weight loss is generally not recommended without medical supervision.");
    }
    results.warnings.push("Disclaimer: These calculations are estimations based on general physiological principles and rules of thumb (e.g., ~2 sec/km improvement per kg lost, constant lean mass if BF% provided). Actual results vary significantly based on individual genetics, training adaptations, nutrition, body composition changes, and other factors.");
    results.warnings.push("Weight loss should be approached healthily. Aim for gradual loss and consult with healthcare professionals or registered dietitians before making significant changes, especially when aiming for low body weight.");


    return results;
}