'use client';

import React, { useState, useMemo } from 'react';
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
import { AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


import { UserInput, CalculationResults, calculateWeightPaceEstimates } from '@/lib/calculations';

export default function HomePage() {
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [heightCm, setHeightCm] = useState<string>('');
  const [weightKg, setWeightKg] = useState<string>('');
  const [bodyFatPercentage, setBodyFatPercentage] = useState<string>('');
  const [thresholdPaceMin, setThresholdPaceMin] = useState<string>('');
  const [thresholdPaceSec, setThresholdPaceSec] = useState<string>('');

  const [results, setResults] = useState<CalculationResults | null>(null);
  const [showResults, setShowResults] = useState<boolean>(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

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
    if (!heightCm || parseFloat(heightCm) <= 50) currentErrors.height = 'Enter valid height (>50 cm)';
    if (!weightKg || parseFloat(weightKg) <= 20) currentErrors.weight = 'Enter valid weight (>20 kg)';
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
      heightCm: parseFloat(heightCm),
      weightKg: parseFloat(weightKg),
      bodyFatPercentage: bodyFatPercentage.trim() && !currentErrors.bfp ? parseFloat(bodyFatPercentage) : null,
      thresholdPaceMin: parseInt(thresholdPaceMin, 10),
      thresholdPaceSec: parseInt(thresholdPaceSec, 10),
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
            <Card>
              <CardHeader>
                <CardTitle>Input Data</CardTitle>
                <CardDescription>
                  Enter your current stats to estimate pace improvements.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    placeholder="e.g., 180"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    min="50"
                    step="0.1"
                    className={cn(errors.height && "border-destructive")}
                  />
                  {errors.height && <p className="text-destructive text-xs mt-1">{errors.height}</p>}
                </div>

                <div>
                  <Label htmlFor="weight">Current Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    placeholder="e.g., 75.5"
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
                  <Label>Threshold Pace (min/km)</Label>
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

                <Button
                  onClick={handleCalculate}
                  className="w-full"
                  disabled={!isValidInput} // <--- Add this line
                >
                  Calculate Estimates
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2">
            {showResults && results && (
              <div className="space-y-6">
                {results.minHealthyWeightKg && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Info</AlertTitle>
                    <AlertDescription>
                      Estimated minimum healthy weight (BMI {18.5}) for your height: <strong>{results.minHealthyWeightKg.toFixed(1)} kg</strong>.
                      The table below shows estimates down to this weight.
                    </AlertDescription>
                  </Alert>
                )}

                <Card>
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
                            <TableHead className="text-center">Target Wt (kg)</TableHead>
                            <TableHead className="text-center">Est. BF (%)</TableHead>
                            <TableHead className="text-center">Est. Thr. Pace</TableHead>
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
                              <TableCell className="text-center font-medium">{row.targetWeightKg.toFixed(1)}</TableCell>
                              <TableCell className="text-center">
                                {row.estimatedBodyFatPercentage !== null ? row.estimatedBodyFatPercentage.toFixed(1) : 'N/A'}
                                {row.isPotentiallyUnhealthyFat && row.estimatedBodyFatPercentage !== null && (
                                  <TooltipProvider><Tooltip><TooltipTrigger asChild><AlertCircle className='w-3 h-3 inline-block ml-1 text-destructive' /></TooltipTrigger><TooltipContent><p>Est. BF% below warning threshold</p></TooltipContent></Tooltip></TooltipProvider>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {row.estimatedThresholdPaceFormatted}
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
