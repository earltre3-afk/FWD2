/**
 * FWD Configuration
 * 
 * Configuration constants and helpers for integrating FWD into Trey TV.
 * 
 * IMPORTANT: Never store secrets here. Only public configuration.
 */

import type { FwdPickerConfig, FwdPickerContext, FwdPickerMode, FwdPickerTheme } from './fwdTypes';

// ============================================================================
// Configuration Constants
// ============================================================================

/**
 * FWD app production URL.
 * This is where the picker iframe loads from.
 */
export const FWD_APP_URL = 'https://fwd.treytv.com';

/**
 * Default theme for the picker.
 */
export const DEFAULT_FWD_THEME: FwdPickerTheme = 'dark';

/**
 * Default mode for the picker.
 */
export const DEFAULT_FWD_MODE: FwdPickerMode = 'compact';

/**
 * Default context when not specified.
 */
export const DEFAULT_FWD_CONTEXT: FwdPickerContext = 'message';

// ============================================================================
// URL Builder
// ============================================================================

/**
 * Build the FWD embed picker URL with all required query parameters.
 * 
 * @example
 * ```ts
 * const url = buildFwdPickerUrl({
 *   key: 'pk_fwd_abc123...',
 *   source: 'trey_tv',
 *   context: 'message',
 *   userUid: '4230000000000000',
 * });
 * // Returns: https://fwd.treytv.com/embed/picker?key=pk_fwd_abc123...&source=trey_tv&context=message&user_uid=4230000000000000&theme=dark&mode=compact
 * ```
 */
export function buildFwdPickerUrl(config: FwdPickerConfig): string {
  const {
    key,
    source,
    context,
    userUid,
    theme = DEFAULT_FWD_THEME,
    mode = DEFAULT_FWD_MODE,
  } = config;

  const params = new URLSearchParams();
  params.set('key', key);
  params.set('source', source);
  params.set('context', context);
  if (userUid) params.set('user_uid', userUid);
  params.set('theme', theme);
  params.set('mode', mode);

  return `${FWD_APP_URL}/embed/picker?${params.toString()}`;
}

/**
 * Build a test URL for the picker (for development/debugging).
 * Note: This will only work if localhost is in the allowed origins for your key.
 */
export function buildFwdTestPickerUrl(config: Omit<FwdPickerConfig, 'source'> & { source?: string }): string {
  return buildFwdPickerUrl({
    ...config,
    source: config.source || 'test_app',
  });
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate that a picker key looks correct (basic format check).
 * This does NOT verify the key is valid on the server.
 */
export function isValidPickerKeyFormat(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  // Expected format: pk_fwd_<24 hex chars>
  return /^pk_fwd_[a-f0-9]{20,32}$/i.test(key);
}

/**
 * Get the FWD app URL, allowing override for development.
 */
export function getFwdAppUrl(): string {
  // In development, you might want to override this
  if (typeof window !== 'undefined') {
    const override = (window as any).__FWD_APP_URL__;
    if (override) return override;
  }
  return FWD_APP_URL;
}
