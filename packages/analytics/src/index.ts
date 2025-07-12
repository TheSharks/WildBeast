export { AnalyticsService, AnalyticsConfig, LogEvent } from './analytics.js';
export { MetricsCollector, PrometheusConfig } from './metrics.js';
export { EventTracker, SessionData } from './events.js';
export { Instrumentor } from './instrumentor.js';

// Re-export types with explicit names to avoid conflicts
export type { MetricEvent } from './metrics.js';
export type { AnalyticsEvent } from './events.js';

import { AnalyticsService, AnalyticsConfig } from './analytics.js';
import { MetricsCollector } from './metrics.js';
import { EventTracker } from './events.js';

// Global analytics instance
let globalAnalytics: AnalyticsService | null = null;

/**
 * Initialize the global analytics service
 */
export async function initializeAnalytics(config: AnalyticsConfig): Promise<AnalyticsService> {
  if (globalAnalytics) {
    throw new Error('Analytics service is already initialized');
  }

  globalAnalytics = new AnalyticsService(config);
  await globalAnalytics.initialize();
  
  return globalAnalytics;
}

/**
 * Get the global analytics service instance
 */
export function getAnalytics(): AnalyticsService {
  if (!globalAnalytics) {
    throw new Error('Analytics service not initialized. Call initializeAnalytics() first.');
  }
  return globalAnalytics;
}

/**
 * Check if analytics is initialized
 */
export function isAnalyticsInitialized(): boolean {
  return globalAnalytics !== null;
}

/**
 * Shutdown the global analytics service
 */
export async function shutdownAnalytics(): Promise<void> {
  if (globalAnalytics) {
    await globalAnalytics.shutdown();
    globalAnalytics = null;
  }
}