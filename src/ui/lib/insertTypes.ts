/**
 * View-layer types for the insertion flow. They intentionally mirror the shared
 * domain types so components stay decoupled from the service worker shape.
 */
export type {
  IntegrationOutcome,
  IntegrationReport,
  StepResult,
  IntegrationStep,
  DomDiagnostics,
} from '../../shared/types';

export interface CompiledPackageLite {
  packageId: string;
  fileName: string;
  totals: { skills: number; categories: number; bytes: number; lines: number };
}
