'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { cn } from "@/lib/utils";
import { Header } from '@/components/ui/header';
import { Footer } from '@/components/ui/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertCircle, Info, AlertTriangle, Link2, HeartPulse } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


import { UserInput, CalculationResults, calculateWeightPaceEstimates, DEFAULT_PACE_FACTOR_SEC_PER_KG_PER_KM, DEFAULT_TARGET_BMI_FLOOR } from '@/lib/calculations';
import { UnitSystem, unitLabels, kgToLb, lbToKg, cmToIn, inToCm, secPerKmToSecPerMile, secPerMileToSecPerKm } from '@/lib/units';
import { decodeForm, encodeForm } from '@/lib/share';
import { formatPace } from '@/lib/utils';

export default function HomePage() {
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [heightCm, setHeightCm] = useState<string>('');
  const [weightKg, setWeightKg] = useState<string>('');
  const [bodyFatPercentage, setBodyFatPercentage] = useState<string>('');
  const [thresholdPaceMin, setThresholdPaceMin] = useState<string>('');
  const [thresholdPaceSec, setThresholdPaceSec] = useState<string>('');

  const [units, setUnits] = useState<UnitSystem>('metric');
  const [paceFactor, setPaceFactor] = useState<string>(String(DEFAULT_PACE_FACTOR_SEC_PER_KG_PER_KM));
  const [bmiFloor, setBmiFloor] = useState<string>(String(DEFAULT_TARGET_BMI_FLOOR));
  const [copied, setCopied] = useState(false);
  const labels = unitLabels(units);
  const fmtWeight = (kg: number) => (units === 'metric' ? kg : kgToLb(kg)).toFixed(1);
  const fmtPace = (secPerKm: number | null) => secPerKm === null ? 'N/A' : formatPace(units === 'metric' ? secPerKm : secPerKmToSecPerMile(secPerKm));

  const [results, setResults] = useState<CalculationResults | null>(null);
  const [showResults, setShowResults] = useState<boolean>(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const f = decodeForm(window.location.search);
    if (!f.height && !f.weight && !f.paceMin && !f.gender) return;
    // One-time hydration from the URL; can't use lazy initial state because the page is statically exported.
    /* eslint-disable react-hooks/set-state-in-effect */
    setUnits(f.units); setGender(f.gender); setHeightCm(f.height); setWeightKg(f.weight);
    setBodyFatPercentage(f.bodyFat); setThresholdPaceMin(f.paceMin); setThresholdPaceSec(f.paceSec);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const convertField = (v: string, fn: (n: number) => number) => {
    const n = parseFloat(v);
    return isNaN(n) ? v : String(Math.round(fn(n) * 10) / 10);
  };

  const switchUnits = (next: UnitSystem) => {
    if (next === units) return;
    const toImp = next === 'imperial';
    setHeightCm((v) => convertField(v, toImp ? cmToIn : inToCm));
    setWeightKg((v) => convertField(v, toImp ? kgToLb : lbToKg));
    const min = parseInt(thresholdPaceMin, 10), sec = parseInt(thresholdPaceSec, 10);
    if (!isNaN(min) && !isNaN(sec)) {
      const total = min * 60 + sec;
      const conv = Math.round(toImp ? secPerKmToSecPerMile(total) : secPerMileToSecPerKm(total));
      setThresholdPaceMin(String(Math.floor(conv / 60)));
      setThresholdPaceSec(String(conv % 60));
    }
    setUnits(next);
    setResults(null);
    setShowResults(false);
  };

  const copyShareLink = async () => {
    const q = encodeForm({ units, gender, height: heightCm, weight: weightKg, bodyFat: bodyFatPercentage, paceMin: thresholdPaceMin, paceSec: thresholdPaceSec });
    const url = `${window.location.origin}${window.location.pathname}${q ? `?${q}` : ''}`;
    window.history.replaceState(null, '', url);
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
  };

  const isValidInput = useMemo(() => {
    return (
      gender &&
      parseFloat(heightCm) > 0 &&
      parseFloat(weightKg) > 0 &&
      parseInt(thresholdPaceMin, 10) >= 0 &&
      parseInt(thresholdPaceSec, 10) >= 0 &&
      parseInt(thresholdPaceSec, 10) < 60
    );
  }, [gender, heightCm, weightKg, thresholdPaceMin, thresholdPaceSec]);


  const handleCalculate = () => {
    const currentErrors: Record<string, string> = {};
    if (!gender) currentErrors.gender = 'Required';
    const heightMetric = units === 'metric' ? parseFloat(heightCm) : inToCm(parseFloat(heightCm));
    const weightMetric = units === 'metric' ? parseFloat(weightKg) : lbToKg(parseFloat(weightKg));
    if (!heightCm || !(heightMetric > 50)) currentErrors.height = 'Enter a valid height (> 50 cm / 20 in)';
    if (!weightKg || !(weightMetric > 20)) currentErrors.weight = 'Enter a valid weight (> 20 kg / 45 lb)';
    const pf = parseFloat(paceFactor), bf = parseFloat(bmiFloor);
    if (isNaN(pf) || pf < 0 || pf > 5) currentErrors.advanced = 'Pace factor must be 0-5 s/km per kg';
    if (isNaN(bf) || bf < 18.5 || bf > 30) currentErrors.advanced = 'BMI floor must be 18.5-30';
    const bfpValue = bodyFatPercentage.trim();
    if (bfpValue && (parseFloat(bfpValue) < 5 || parseFloat(bfpValue) > 70)) {
      currentErrors.bfp = 'If entered, use 5-70%';
    }
    const tPaceMin = parseInt(thresholdPaceMin, 10);
    const tPaceSec = parseInt(thresholdPaceSec, 10);
    if (isNaN(tPaceMin) || tPaceMin < 0 || isNaN(tPaceSec) || tPaceSec < 0 || tPaceSec >= 60 || (tPaceMin === 0 && tPaceSec === 0)) {
      currentErrors.pace = 'Enter valid pace (> 0:00)';
    }

    setErrors(currentErrors);

    if (Object.keys(currentErrors).length > 0) {
      setResults(null);
      setShowResults(false);
      return;
    }


    const userInput: UserInput = {
      gender: gender as 'male' | 'female',
      heightCm: heightMetric,
      weightKg: weightMetric,
      bodyFatPercentage: bodyFatPercentage.trim() && !currentErrors.bfp ? parseFloat(bodyFatPercentage) : null,
      ...(() => {
        const total = parseInt(thresholdPaceMin, 10) * 60 + parseInt(thresholdPaceSec, 10);
        const perKm = units === 'metric' ? total : Math.round(secPerMileToSecPerKm(total));
        return { thresholdPaceMin: Math.floor(perKm / 60), thresholdPaceSec: perKm % 60 };
      })(),
      paceFactorSecPerKg: pf,
      bmiFloor: bf,
    };
    const calculatedData = calculateWeightPaceEstimates(userInput);
    setResults(calculatedData);
    setShowResults(true);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <Card interactive>
              <CardHeader>
                <CardTitle>Input Data</CardTitle>
                <CardDescription>
                  Enter your current stats to estimate pace improvements.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div role="group" aria-label="Units" className="grid grid-cols-2 gap-1 rounded-md border p-1">
                  {(['metric', 'imperial'] as const).map((u) => (
                    <Button key={u} type="button" size="sm" variant={units === u ? 'default' : 'ghost'} aria-pressed={units === u} onClick={() => switchUnits(u)}>
                      {u === 'metric' ? 'kg · cm · km' : 'lb · in · mi'}
                    </Button>
                  ))}
                </div>
                <div>
                  <Label htmlFor="gender">Biological Gender</Label>
                  <Select value={gender} onValueChange={(value) => setGender(value as 'male' | 'female' | '')}>
                    <SelectTrigger id="gender" className={cn(errors.gender && "border-destructive")}>
                      <SelectValue placeholder="Select gender..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.gender && <p className="text-destructive text-xs mt-1">{errors.gender}</p>}
                </div>

                <div>
                  <Label htmlFor="height">Height ({labels.height})</Label>
                  <Input
                    id="height"
                    type="number"
                    placeholder={units === 'metric' ? 'e.g., 180' : 'e.g., 71'}
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    min="50"
                    step="0.1"
                    className={cn(errors.height && "border-destructive")}
                  />
                  {errors.height && <p className="text-destructive text-xs mt-1">{errors.height}</p>}
                </div>

                <div>
                  <Label htmlFor="weight">Current Weight ({labels.weight})</Label>
                  <Input
                    id="weight"
                    type="number"
                    placeholder={units === 'metric' ? 'e.g., 75.5' : 'e.g., 166'}
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    min="20"
                    step="0.1"
                    className={cn(errors.weight && "border-destructive")}
                  />
                  {errors.weight && <p className="text-destructive text-xs mt-1">{errors.weight}</p>}
                </div>

                <div>
                  <Label htmlFor="bfp">Body Fat Percentage (%) <span className='text-muted-foreground text-xs'>(Optional)</span></Label>
                  <Input
                    id="bfp"
                    type="number"
                    placeholder="e.g., 15 (Optional)"
                    value={bodyFatPercentage}
                    onChange={(e) => setBodyFatPercentage(e.target.value)}
                    min="1"
                    max="70"
                    step="0.1"
                    className={cn(errors.bfp && "border-destructive")}
                  />
                  {errors.bfp && <p className="text-destructive text-xs mt-1">{errors.bfp}</p>}
                </div>

                <div>
                  <Label>Threshold Pace ({labels.pace})</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="inline-block w-4 h-4 ml-1 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Your lactate threshold pace - typically the pace you could sustain for about 60 minutes in a race.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div className="flex items-center gap-2">
                    <Input
                      id="pace-min"
                      type="number"
                      placeholder="min"
                      value={thresholdPaceMin}
                      onChange={(e) => setThresholdPaceMin(e.target.value)}
                      min="0"
                      className={cn("w-1/2", errors.pace && "border-destructive")}
                      aria-label="Threshold pace minutes"
                    />
                    <span>:</span>
                    <Input
                      id="pace-sec"
                      type="number"
                      placeholder="sec"
                      value={thresholdPaceSec}
                      onChange={(e) => setThresholdPaceSec(e.target.value)}
                      min="0"
                      max="59"
                      className={cn("w-1/2", errors.pace && "border-destructive")}
                      aria-label="Threshold pace seconds"
                    />
                  </div>
                  {errors.pace && <p className="text-destructive text-xs mt-1">{errors.pace}</p>}
                </div>

                <details className="rounded-md border p-3 text-sm">
                  <summary className="cursor-pointer font-medium">Advanced assumptions</summary>
                  <div className="mt-3 space-y-3">
                    <div>
                      <Label htmlFor="pace-factor">Pace gain (s/km per kg lost)</Label>
                      <Input id="pace-factor" type="number" min="0" max="5" step="0.1" value={paceFactor} onChange={(e) => setPaceFactor(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="bmi-floor">Lowest BMI to show</Label>
                      <Input id="bmi-floor" type="number" min="18.5" max="30" step="0.5" value={bmiFloor} onChange={(e) => setBmiFloor(e.target.value)} />
                      <p className="text-xs text-muted-foreground mt-1">Never below 18.5 (the WHO underweight threshold).</p>
                    </div>
                    {errors.advanced && <p className="text-destructive text-xs">{errors.advanced}</p>}
                  </div>
                </details>

                <Button
                  onClick={handleCalculate}
                  className="w-full"
                  disabled={!isValidInput}
                >
                  Calculate Estimates
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={copyShareLink} disabled={!heightCm && !weightKg}>
                  <Link2 className="w-4 h-4 mr-2" /> {copied ? 'Link copied!' : 'Copy share link'}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2">
            {showResults && results && (
              <div className="space-y-6">
                <Alert>
                  <HeartPulse className="h-4 w-4" />
                  <AlertTitle>Read this first</AlertTitle>
                  <AlertDescription>
                    These are rough estimates, not a weight-loss plan. Faster running from lower weight only holds if you stay healthy and well fuelled. Don&apos;t aim below a healthy weight for your height, and talk to a doctor or dietitian before changing your weight.
                  </AlertDescription>
                </Alert>
                {results.minHealthyWeightKg && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Info</AlertTitle>
                    <AlertDescription>
                      The table runs down to BMI {bmiFloor}, i.e. <strong>{fmtWeight(results.minHealthyWeightKg)} {labels.weight}</strong> for your height.
                    </AlertDescription>
                  </Alert>
                )}

                <Card interactive>
                  <CardHeader>
                    <CardTitle>Estimated Improvements</CardTitle>
                    <CardDescription>
                      Projected pace and race times at different target weights.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {results.resultsTable.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-center">Target Wt ({labels.weight})</TableHead>
                            <TableHead className="text-center">Est. BF (%)</TableHead>
                            <TableHead className="text-center">Est. Thr. Pace ({labels.pace})</TableHead>
                            <TableHead className="text-center">Est. 5K Time</TableHead>
                            <TableHead className="text-center">Est. 10K Time</TableHead>
                            <TableHead className="text-center">Est. HM Time</TableHead>
                            <TableHead className="text-center">Est. Marathon Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {results.resultsTable.map((row, index) => (
                            <TableRow
                              key={index}
                              className={cn(row.isPotentiallyUnhealthyFat ? "text-destructive" : "")}
                            >
                              <TableCell className="text-center font-medium">{index === 0 && weightKg ? parseFloat(weightKg).toFixed(1) : fmtWeight(row.targetWeightKg)}</TableCell>
                              <TableCell className="text-center">
                                {row.estimatedBodyFatPercentage !== null ? row.estimatedBodyFatPercentage.toFixed(1) : 'N/A'}
                                {row.isPotentiallyUnhealthyFat && row.estimatedBodyFatPercentage !== null && (
                                  <TooltipProvider><Tooltip><TooltipTrigger asChild><AlertCircle className='w-3 h-3 inline-block ml-1 text-destructive' /></TooltipTrigger><TooltipContent><p>Est. BF% below warning threshold</p></TooltipContent></Tooltip></TooltipProvider>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {fmtPace(row.estimatedThresholdPaceSec)}
                                {row.paceLimited && <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className='w-3 h-3 inline-block ml-1 text-blue-500' /></TooltipTrigger><TooltipContent><p>Pace improvement capped</p></TooltipContent></Tooltip></TooltipProvider>}
                              </TableCell>
                              <TableCell className="text-center">{row.estimated5kTimeFormatted}</TableCell>
                              <TableCell className="text-center">{row.estimated10kTimeFormatted}</TableCell>
                              <TableCell className="text-center">{row.estimatedHmTimeFormatted}</TableCell>
                              <TableCell className="text-center">{row.estimatedMTimeFormatted}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No results generated. Please check inputs or warnings.</p>
                    )}
                  </CardContent>
                </Card>

                {results.warnings && results.warnings.length > 0 && (
                  <Card className="border-amber-500/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-5 h-5" /> Warnings & Disclaimers
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {results.warnings.map((warning, index) => (
                        <Alert key={index} className="border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            {warning}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
            {!showResults && !Object.keys(errors).length && (
              <Card className="md:col-span-2 flex items-center justify-center h-64 border-dashed">
                <p className="text-muted-foreground">Results will appear here after calculation.</p>
              </Card>
            )}
            {!showResults && Object.keys(errors).length > 0 && (
              <Card className="md:col-span-2 flex items-center justify-center h-64 border-dashed border-destructive">
                <div className="text-center text-destructive">
                  <AlertCircle className="mx-auto h-8 w-8 mb-2" />
                  <p className="font-semibold">Calculation Errors</p>
                  <p className="text-sm">Please fix the errors in the input fields.</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
