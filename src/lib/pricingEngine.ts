import { FareConfig, VehicleCategory } from '../types/domain';

export interface FareCalculationInput {
  config: Pick<
    FareConfig,
    | 'baseFare'
    | 'minimumFare'
    | 'perKmRate'
    | 'perMinuteRate'
    | 'waitingChargePerMin'
    | 'surgeMultiplier'
    | 'commissionPct'
    | 'cancellationFee'
    | 'city'
    | 'vehicleCategory'
  >;
  distanceKm: number;
  durationMin: number;
  waitingMin?: number;
  discountAmount?: number;
}

export interface FareCalculationResult {
  city: string;
  vehicleCategory: VehicleCategory;
  baseFare: number;
  distanceCharge: number;
  timeCharge: number;
  waitingCharge: number;
  surgeMultiplier: number;
  subtotalBeforeSurge: number;
  surgeAmount: number;
  minimumFareApplied: boolean;
  discountAmount: number;
  finalFare: number;
  commissionPct: number;
  commissionAmount: number;
  driverPayoutAmount: number;
  cancellationFee: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateFareBreakdown(input: FareCalculationInput): FareCalculationResult {
  const { config, distanceKm, durationMin, waitingMin = 0, discountAmount = 0 } = input;
  if (distanceKm < 0 || durationMin < 0 || waitingMin < 0) {
    throw new Error('Distance, duration, and waiting time must be non-negative.');
  }
  if (config.surgeMultiplier < 1 || config.surgeMultiplier > 5) {
    throw new Error('Surge multiplier must be between 1.0x and 5.0x.');
  }
  if (config.commissionPct < 0 || config.commissionPct > 50) {
    throw new Error('Commission percentage must be between 0% and 50%.');
  }

  const distanceCharge = round2(distanceKm * config.perKmRate);
  const timeCharge = round2(durationMin * config.perMinuteRate);
  const waitingCharge = round2(waitingMin * config.waitingChargePerMin);
  const subtotalBeforeSurge = round2(config.baseFare + distanceCharge + timeCharge + waitingCharge);
  const surgedTotal = round2(subtotalBeforeSurge * config.surgeMultiplier);
  const surgeAmount = round2(surgedTotal - subtotalBeforeSurge);

  const minimumFareApplied = surgedTotal < config.minimumFare;
  const grossFare = minimumFareApplied ? config.minimumFare : surgedTotal;
  const appliedDiscount = Math.min(grossFare, Math.max(0, round2(discountAmount)));
  const finalFare = round2(Math.max(0, grossFare - appliedDiscount));

  const commissionAmount = round2((finalFare * config.commissionPct) / 100);
  const driverPayoutAmount = round2(finalFare - commissionAmount);

  return {
    city: config.city,
    vehicleCategory: config.vehicleCategory,
    baseFare: round2(config.baseFare),
    distanceCharge,
    timeCharge,
    waitingCharge,
    surgeMultiplier: config.surgeMultiplier,
    subtotalBeforeSurge,
    surgeAmount,
    minimumFareApplied,
    discountAmount: appliedDiscount,
    finalFare,
    commissionPct: config.commissionPct,
    commissionAmount,
    driverPayoutAmount,
    cancellationFee: round2(config.cancellationFee),
  };
}
