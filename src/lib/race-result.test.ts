import { describe, expect, it } from 'vitest';
import { RACE_DISTANCES, calculateWeightPaceEstimates, estimateRaceTimeSec, racePaceFactor, thresholdPaceFromRace } from './calculations';
import { buildInput } from './form';
import { convertRaceDistance, deriveRacePace, parseRaceTime } from './race-result';
import { decodeForm, emptyForm, encodeForm, type FormState } from './share';

const adv = { paceFactor: '2', bmiFloor: '20' };
const base: FormState = { ...emptyForm, gender: 'male', height: '180', weight: '80' };
/** 5K in 22:30 -> threshold pace 4:44/km. */
const race5k: FormState = { ...base, paceSource: 'race', raceDist: '5k', raceM: '22', raceS: '30' };

describe('thresholdPaceFromRace', () => {
    it('inverts estimateRaceTimeSec for the four standard distances', () => {
        for (const km of Object.values(RACE_DISTANCES)) {
            for (const pace of [150, 240, 270, 330, 420]) {
                expect(thresholdPaceFromRace(estimateRaceTimeSec(pace, km), km)).toBeCloseTo(pace, 9);
            }
        }
    });
    it('inverts estimateRaceTimeSec for custom distances, including the clamped ends', () => {
        for (const km of [0.5, 1, 1.6, 3, 7.5, 12, 15, 25, 30, 50, 80, 100, 150]) {
            expect(thresholdPaceFromRace(estimateRaceTimeSec(285, km), km)).toBeCloseTo(285, 9);
        }
    });
    it('computes a known value: 5K in 20:00 is 252.6 s/km', () => {
        expect(thresholdPaceFromRace(1200, 5)).toBeCloseTo(1200 / 5 / 0.95, 10);
    });
    it('is monotonic: slower race -> slower threshold; same time over a longer distance -> faster threshold', () => {
        for (const km of [5, 10, 21.0975, 42.195, 17]) {
            let prev = 0;
            for (let t = 600; t <= 20000; t += 400) {
                const p = thresholdPaceFromRace(t, km);
                expect(p).toBeGreaterThan(prev);
                prev = p;
            }
        }
        let prev = Infinity;
        for (let km = 1; km <= 100; km += 0.5) {
            const p = thresholdPaceFromRace(7200, km);
            expect(p).toBeLessThan(prev);
            prev = p;
        }
    });
    it('rejects non-positive and non-finite input', () => {
        for (const [t, d] of [[0, 5], [-60, 5], [1200, 0], [1200, -5], [NaN, 5], [1200, NaN], [Infinity, 5], [1200, Infinity]]) {
            expect(() => thresholdPaceFromRace(t, d)).toThrow(RangeError);
        }
    });
    it('uses the same factor as racePaceFactor', () => {
        expect(thresholdPaceFromRace(3600, 10)).toBeCloseTo(360 / racePaceFactor(10), 10);
    });
});

describe('parseRaceTime', () => {
    it('parses h:mm:ss with optional hours', () => {
        expect(parseRaceTime('1', '47', '31')).toEqual({ status: 'ok', sec: 6451 });
        expect(parseRaceTime('', '22', '30')).toEqual({ status: 'ok', sec: 1350 });
        expect(parseRaceTime('0', '22', '30')).toEqual({ status: 'ok', sec: 1350 });
        expect(parseRaceTime('', '85', '00')).toEqual({ status: 'ok', sec: 5100 });
    });
    it('needs minutes and seconds', () => {
        expect(parseRaceTime('', '', '')).toEqual({ status: 'missing' });
        expect(parseRaceTime('3', '', '')).toEqual({ status: 'missing' });
        expect(parseRaceTime('', '22', '')).toEqual({ status: 'missing' });
        expect(parseRaceTime('', '', '30')).toEqual({ status: 'missing' });
        expect(parseRaceTime('  ', ' ', ' ')).toEqual({ status: 'missing' });
    });
    it('rejects zero, negative, fractional and non-numeric parts', () => {
        for (const [h, m, s] of [['', '0', '0'], ['0', '0', '0'], ['', '-5', '30'], ['', '22', '-1'], ['-1', '22', '30'], ['', '22.5', '0'], ['', '22', '3.5'], ['', '2e1', '0'], ['x', '22', '30']]) {
            expect(parseRaceTime(h, m, s).status, `${h}:${m}:${s}`).toBe('invalid');
        }
    });
    it('rejects invalid input even while another part is still empty', () => {
        expect(parseRaceTime('', '-5', '').status).toBe('invalid');
    });
    it('limits seconds to 0-59 and minutes to 0-59 once hours are entered', () => {
        expect(parseRaceTime('', '22', '60').status).toBe('invalid');
        expect(parseRaceTime('', '22', '59').status).toBe('ok');
        expect(parseRaceTime('1', '60', '00').status).toBe('invalid');
        expect(parseRaceTime('1', '59', '59').status).toBe('ok');
        expect(parseRaceTime('0', '75', '00').status).toBe('invalid');
        expect(parseRaceTime('', '1000', '00').status).toBe('invalid');
    });
    it('limits hours to 99', () => {
        expect(parseRaceTime('99', '0', '1').status).toBe('ok');
        expect(parseRaceTime('100', '0', '1').status).toBe('invalid');
    });
});

describe('deriveRacePace', () => {
    it('derives the pace in km for the preset distances', () => {
        const d = deriveRacePace(race5k);
        expect(d).toMatchObject({ distanceKm: 5, timeSec: 1350, missing: [], errors: {} });
        expect(d.perKm).toBeCloseTo(1350 / 5 / 0.95, 10);
        expect(d.displaySec).toBe(Math.round(1350 / 5 / 0.95));
        expect(deriveRacePace({ ...race5k, raceDist: 'm', raceH: '3', raceM: '45', raceS: '0' }).distanceKm).toBe(42.195);
        expect(deriveRacePace({ ...race5k, raceDist: 'hm', raceH: '1', raceM: '45', raceS: '0' }).distanceKm).toBe(21.0975);
    });
    it('shows the pace per mile in imperial units and feeds the calculator the same exact per-km pace as in metric', () => {
        const d = deriveRacePace({ ...race5k, units: 'imperial' });
        const exact = 1350 / 5 / 0.95;
        expect(d.displaySec).toBe(Math.round(exact * 1.609344));
        expect(d.perKm).toBe(deriveRacePace(race5k).perKm);
        expect(d.perKm).toBeCloseTo(exact, 10);
    });
    it('reads a custom distance in the selected units', () => {
        expect(deriveRacePace({ ...race5k, raceDist: 'custom', raceCustom: '15' }).distanceKm).toBe(15);
        expect(deriveRacePace({ ...race5k, units: 'imperial', raceDist: 'custom', raceCustom: '10' }).distanceKm).toBeCloseTo(16.09344, 5);
    });
    it('tracks what is missing', () => {
        expect(deriveRacePace(emptyForm).missing).toEqual(['raceTime']);
        expect(deriveRacePace({ ...emptyForm, raceDist: 'custom' }).missing).toEqual(['raceDistance', 'raceTime']);
        expect(deriveRacePace({ ...race5k, raceDist: 'custom', raceCustom: ' ' }).missing).toEqual(['raceDistance']);
    });
    it('flags out-of-range custom distances', () => {
        expect(deriveRacePace({ ...race5k, raceDist: 'custom', raceCustom: '0.5' }).errors.raceDistance).toBe('err.distance.metric');
        expect(deriveRacePace({ ...race5k, raceDist: 'custom', raceCustom: '101' }).errors.raceDistance).toBe('err.distance.metric');
        expect(deriveRacePace({ ...race5k, raceDist: 'custom', raceCustom: '-5' }).errors.raceDistance).toBe('err.distance.metric');
        expect(deriveRacePace({ ...race5k, units: 'imperial', raceDist: 'custom', raceCustom: '70' }).errors.raceDistance).toBe('err.distance.imperial');
        expect(deriveRacePace({ ...race5k, raceDist: 'custom', raceCustom: '1' }).errors.raceDistance).toBeUndefined();
        expect(deriveRacePace({ ...race5k, raceDist: 'custom', raceCustom: '100' }).errors.raceDistance).toBeUndefined();
    });
    it('rejects implied threshold paces outside 2:00-12:00 per km', () => {
        expect(deriveRacePace({ ...race5k, raceM: '9', raceS: '30' })).toMatchObject({ displaySec: 120, errors: {} });
        expect(deriveRacePace({ ...race5k, raceM: '9', raceS: '27' }).errors.raceTime).toBe('raceResult.err.pace.metric');
        expect(deriveRacePace({ ...race5k, raceM: '57', raceS: '0' })).toMatchObject({ displaySec: 720, errors: {} });
        expect(deriveRacePace({ ...race5k, raceM: '57', raceS: '30' }).errors.raceTime).toBe('raceResult.err.pace.metric');
        expect(deriveRacePace({ ...race5k, units: 'imperial', raceM: '57', raceS: '30' }).errors.raceTime).toBe('raceResult.err.pace.imperial');
        const bad = deriveRacePace({ ...race5k, raceM: '2', raceS: '0' });
        expect(bad.perKm).toBeNull();
        expect(bad.displaySec).toBeNull();
    });
    it('keeps the displayed pace stable when the unit toggle converts a custom distance', () => {
        for (const km of ['1', '2.5', '3', '5', '7', '8', '12', '15', '16.1', '21.1', '25', '30', '42.2', '50', '80', '100']) {
            const metric = { ...race5k, raceDist: 'custom' as const, raceCustom: km, raceM: '58', raceS: '10', raceH: '1' };
            const imperial = { ...metric, units: 'imperial' as const, raceCustom: convertRaceDistance(km, true) };
            const back = { ...imperial, units: 'metric' as const, raceCustom: convertRaceDistance(imperial.raceCustom, false) };
            const before = deriveRacePace(metric).perKm!;
            expect(Math.abs(deriveRacePace(imperial).perKm! - before), `${km} km as miles`).toBeLessThanOrEqual(1);
            expect(Math.abs(deriveRacePace(back).perKm! - before), `${km} km round trip`).toBeLessThanOrEqual(1);
            expect(back.raceCustom, `${km} km round trip text`).toBe(km);
        }
    });
    it('does not round the pace that feeds the model, so the units cannot move any estimate', () => {
        // Preset distances: the unit toggle changes nothing the model sees.
        for (const raceDist of ['5k', '10k', 'hm', 'm'] as const) {
            for (const [raceH, raceM, raceS] of [['', '22', '30'], ['', '48', '26'], ['1', '45', '0'], ['3', '0', '0'], ['4', '0', '0']]) {
                const metric = { ...race5k, raceDist, raceH, raceM, raceS };
                const a = deriveRacePace(metric);
                const b = deriveRacePace({ ...metric, units: 'imperial' });
                if (a.perKm === null) continue;
                expect(b.perKm, `${raceDist} ${raceH}:${raceM}:${raceS}`).toBe(a.perKm);
            }
        }
    });
});

describe('convertRaceDistance', () => {
    it('converts between km and miles with up to two decimals', () => {
        expect(convertRaceDistance('10', true)).toBe('6.21');
        expect(convertRaceDistance('6.21', false)).toBe('10');
        expect(convertRaceDistance('5', true)).toBe('3.11');
        expect(convertRaceDistance('26.2', false)).toBe('42.16');
    });
    it('leaves empty or unparseable values alone', () => {
        expect(convertRaceDistance('', true)).toBe('');
        expect(convertRaceDistance('abc', false)).toBe('abc');
    });
});

describe('buildInput in race mode', () => {
    it('produces the derived threshold pace, unrounded', () => {
        const { input, errors, missing } = buildInput(race5k, adv);
        const perKm = 1350 / 5 / 0.95;
        expect(input).toMatchObject({ heightCm: 180, weightKg: 80, thresholdPaceMin: Math.floor(perKm / 60) });
        expect(input!.thresholdPaceMin * 60 + input!.thresholdPaceSec).toBeCloseTo(perKm, 9);
        expect(errors).toEqual({});
        expect(missing).toEqual([]);
    });
    it('gives back the entered result in the row for no weight change, for every preset distance', () => {
        const cases = [
            ['5k', '', '25', '0', 'estimated5kTimeSec', 1500], ['10k', '', '48', '26', 'estimated10kTimeSec', 2906],
            ['hm', '2', '10', '0', 'estimatedHmTimeSec', 7800], ['m', '3', '0', '0', 'estimatedMTimeSec', 10800], ['m', '4', '0', '0', 'estimatedMTimeSec', 14400],
        ] as const;
        for (const [raceDist, raceH, raceM, raceS, field, seconds] of cases) {
            for (const units of ['metric', 'imperial'] as const) {
                const input = buildInput({ ...race5k, units, height: units === 'metric' ? '180' : '70.9', weight: units === 'metric' ? '80' : '176.4', raceDist, raceH, raceM, raceS }, adv).input!;
                const first = calculateWeightPaceEstimates(input).resultsTable[0];
                expect(Math.round(first[field]!), `${raceDist} ${units}`).toBe(seconds);
            }
        }
    });
    it('feeds the results like the same pace typed in, to within a second per km', () => {
        const typed = buildInput({ ...base, paceMin: '4', paceSec: '44' }, adv).input!;
        const fromRace = buildInput(race5k, adv).input!;
        const sec = (i: typeof typed) => i.thresholdPaceMin * 60 + i.thresholdPaceSec;
        expect(Math.abs(sec(fromRace) - sec(typed))).toBeLessThan(0.5);
        expect(fromRace).toMatchObject({ gender: 'male', heightCm: 180, weightKg: 80 });
    });
    it('ignores the typed pace in race mode and the race fields in threshold mode', () => {
        const typed = { ...race5k, paceMin: '9', paceSec: '99' };
        expect(buildInput(typed, adv).errors).toEqual({});
        expect(buildInput(typed, adv).input).toEqual(buildInput(race5k, adv).input);
        const threshold = { ...base, paceMin: '4', paceSec: '30', raceDist: 'custom' as const, raceM: '99', raceS: '99' };
        expect(buildInput(threshold, adv).errors).toEqual({});
        expect(buildInput(threshold, adv).input).toMatchObject({ thresholdPaceMin: 4, thresholdPaceSec: 30 });
    });
    it('says what is still needed', () => {
        expect(buildInput({ ...emptyForm, paceSource: 'race' }, adv).missing).toEqual(['gender', 'height', 'weight', 'raceTime']);
        expect(buildInput({ ...emptyForm, paceSource: 'race', raceDist: 'custom' }, adv).missing).toEqual(['gender', 'height', 'weight', 'raceDistance', 'raceTime']);
        const r = buildInput({ ...race5k, raceS: '' }, adv);
        expect(r.input).toBeNull();
        expect(r.missing).toEqual(['raceTime']);
        expect(r.errors).toEqual({});
    });
    it('reports invalid times with a message key', () => {
        for (const patch of [{ raceS: '60' }, { raceM: '0', raceS: '0' }, { raceM: '-5' }, { raceH: '1', raceM: '75' }, { raceS: '1.5' }]) {
            const r = buildInput({ ...race5k, ...patch }, adv);
            expect(r.input, JSON.stringify(patch)).toBeNull();
            expect(r.errors.raceTime, JSON.stringify(patch)).toBe('raceResult.err.time');
        }
    });
    it('asks the user to check the time when the implied pace is implausible', () => {
        expect(buildInput({ ...race5k, raceM: '3', raceS: '0' }, adv).errors.raceTime).toBe('raceResult.err.pace.metric');
        expect(buildInput({ ...race5k, units: 'imperial', raceM: '3', raceS: '0' }, adv).errors.raceTime).toBe('raceResult.err.pace.imperial');
        expect(buildInput({ ...race5k, raceDist: 'm', raceH: '9', raceM: '30', raceS: '0' }, adv).errors.raceTime).toBe('raceResult.err.pace.metric');
        expect(buildInput({ ...race5k, raceM: '3', raceS: '0' }, adv).input).toBeNull();
    });
    it('validates a custom race distance independently from the optional result-card distance', () => {
        const custom = { ...race5k, raceDist: 'custom' as const, raceCustom: '12', raceH: '1', raceM: '5', raceS: '0' };
        expect(buildInput(custom, adv).input).not.toBeNull();
        expect(buildInput({ ...custom, raceCustom: '500' }, adv).errors.raceDistance).toBe('err.distance.metric');
        expect(buildInput({ ...custom, distance: '15' }, adv).customDistanceKm).toBe(15);
        expect(buildInput({ ...custom, distance: '500' }, adv).errors).toEqual({ distance: 'err.distance.metric' });
    });
    it('still reports unrelated field errors', () => {
        const r = buildInput({ ...race5k, height: '20' }, adv);
        expect(Object.keys(r.errors)).toEqual(['height']);
    });
    it('gives the same results in imperial units to within a second per km', () => {
        const metric = buildInput(race5k, adv).input!;
        const imperial = buildInput({ ...race5k, units: 'imperial', height: '70.87', weight: '176.4' }, adv).input!;
        const sec = (i: typeof metric) => i.thresholdPaceMin * 60 + i.thresholdPaceSec;
        expect(Math.abs(sec(imperial) - sec(metric))).toBeLessThanOrEqual(1);
    });
});

describe('share link keys for the race result', () => {
    const state: FormState = { ...race5k, units: 'imperial', raceDist: 'custom', raceCustom: '9.3', raceH: '1', raceM: '5', raceS: '9' };
    it('round-trips', () => {
        expect(decodeForm(encodeForm(state))).toEqual(state);
        expect(decodeForm(encodeForm(race5k))).toEqual(race5k);
    });
    it('uses short keys and omits defaults', () => {
        const p = new URLSearchParams(encodeForm(state));
        expect([p.get('pace'), p.get('rd'), p.get('rdc'), p.get('rth'), p.get('rtm'), p.get('rts')]).toEqual(['race', 'custom', '9.3', '1', '5', '9']);
        const q = new URLSearchParams(encodeForm(race5k));
        expect(q.has('rd')).toBe(false);
        expect(q.get('pace')).toBe('race');
        expect(encodeForm(emptyForm)).toBe('');
    });
    it('decodes existing links as threshold-pace mode', () => {
        const f = decodeForm('g=female&h=170&w=64&bf=22&pm=5&ps=0&d=15&u=imperial');
        expect(f).toEqual({ ...emptyForm, gender: 'female', height: '170', weight: '64', bodyFat: '22', paceMin: '5', paceSec: '0', distance: '15', units: 'imperial' });
        expect(f.paceSource).toBe('threshold');
    });
    it('rejects garbage', () => {
        expect(decodeForm('pace=evil&rd=marathon&rdc=abc&rth=999&rtm=-5&rts=1e3')).toEqual(emptyForm);
        expect(decodeForm('pace=RACE&rd=HM')).toEqual(emptyForm);
        expect(decodeForm('rd=<script>&rdc=1.2.3&rth=1.5&rtm=&rts=%20')).toEqual(emptyForm);
        expect(decodeForm('rth=1&rtm=45&rts=30&rd=hm&pace=race')).toMatchObject({ paceSource: 'race', raceDist: 'hm', raceH: '1', raceM: '45', raceS: '30' });
    });
    it('drops out-of-range time parts', () => {
        expect(decodeForm('rts=60').raceS).toBe('');
        expect(decodeForm('rts=59').raceS).toBe('59');
        expect(decodeForm('rth=1&rtm=60').raceM).toBe('');
        expect(decodeForm('rth=1&rtm=59').raceM).toBe('59');
        expect(decodeForm('rtm=75').raceM).toBe('75');
        expect(decodeForm('rth=123').raceH).toBe('');
    });
});
