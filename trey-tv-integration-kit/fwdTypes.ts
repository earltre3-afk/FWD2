/**
 * FWD GIF Picker TypeScript Types
 * 
 * Use these types to integrate the FWD embedded GIF picker into Trey TV
 * or any other application.
 */

// ============================================================================
// GIF Payload
// ============================================================================

/**
 * The GIF object returned when a user selects a GIF from the picker.
 */
export interface FwdGifPayload {
  /** Unique identifier for this GIF */
  id: string;
  /** Human-readable title */
  title: string;
  /** Full quality GIF or video URL */
  mediaUrl: string;
  /** Preview quality URL (usually same as mediaUrl for GIFs) */
  previewUrl: string;
  /** Thumbnail URL for compact displays */
  thumbnailUrl: string;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Duration in seconds (for video GIFs) */
  duration: number;
  /** Format: 'gif' | 'mp4' | 'webm' */
  format: 'gif' | 'mp4' | 'webm';
  /** Short description for accessibility */
  altText: string;
  /** Tags/keywords for searchability */
  tags: string[];
}

// ============================================================================
// Picker Context & Mode
// ============================================================================

/**
 * Context where the picker is being used.
 * This helps FWD track usage patterns (anonymously).
 */
export type FwdPickerContext =
  | 'message'
  | 'comment'
  | 'group_chat'
  | 'watch_party'
  | 'creator_channel'
  | 'feed_post'
  | 'profile_reaction';

/**
 * Picker display mode.
 * - compact: Bottom sheet style, good for mobile
 * - full: Larger modal, good for desktop
 */
export type FwdPickerMode = 'compact' | 'full';

/**
 * Picker theme.
 */
export type FwdPickerTheme = 'dark' | 'light';

/**
 * Source identifier for the integrating app.
 */
export type FwdPickerSource = 'trey_tv' | 'external_app' | string;

// ============================================================================
// PostMessage Events
// ============================================================================

/**
 * Base event structure for all FWD picker events.
 */
interface FwdPickerEventBase {
  /** Event type identifier */
  type: string;
  /** Always 'fwd' for FWD picker events */
  provider: 'fwd';
  /** Source app identifier */
  source?: string;
}

/**
 * Event sent when a user selects a GIF.
 */
export interface FwdPickerSelectedEvent extends FwdPickerEventBase {
  type: 'FWD_GIF_SELECTED';
  /** The selected GIF payload */
  gif: FwdGifPayload;
  /** Usage tracking info (public, non-sensitive) */
  usage: {
    source?: string;
    context?: FwdPickerContext;
    /** Public user association ID (not for permissions, just tracking) */
    userUid?: string;
  };
}

/**
 * Event sent when user closes the picker without selecting.
 */
export interface FwdPickerClosedEvent extends FwdPickerEventBase {
  type: 'FWD_PICKER_CLOSED';
}

/**
 * Event sent when an error occurs in the picker.
 */
export interface FwdPickerErrorEvent extends FwdPickerEventBase {
  type: 'FWD_PICKER_ERROR';
  /** User-friendly error message */
  message: string;
}

/**
 * Event sent when picker is ready and loaded.
 */
export interface FwdPickerReadyEvent extends FwdPickerEventBase {
  type: 'FWD_PICKER_READY';
}

/**
 * Union of all picker events.
 */
export type FwdPickerEvent =
  | FwdPickerSelectedEvent
  | FwdPickerClosedEvent
  | FwdPickerErrorEvent
  | FwdPickerReadyEvent;

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for building the picker embed URL.
 */
export interface FwdPickerConfig {
  /** Your public embed key from FWD dashboard */
  key: string;
  /** Source identifier (e.g., 'trey_tv') */
  source: FwdPickerSource;
  /** Context where picker is used */
  context: FwdPickerContext;
  /** Optional user UID for usage tracking */
  userUid?: string;
  /** Theme: 'dark' or 'light' */
  theme?: FwdPickerTheme;
  /** Mode: 'compact' or 'full' */
  mode?: FwdPickerMode;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a message event is a FWD picker event.
 */
export function isFwdPickerEvent(data: unknown): data is FwdPickerEvent {
  if (!data || typeof data !== 'object') return false;
  const event = data as Record<string, unknown>;
  return (
    typeof event.type === 'string' &&
    event.type.startsWith('FWD_') &&
    event.provider === 'fwd'
  );
}

/**
 * Check if event is a GIF selected event.
 */
export function isFwdGifSelectedEvent(data: unknown): data is FwdPickerSelectedEvent {
  return isFwdPickerEvent(data) && data.type === 'FWD_GIF_SELECTED';
}

/**
 * Check if event is a picker closed event.
 */
export function isFwdPickerClosedEvent(data: unknown): data is FwdPickerClosedEvent {
  return isFwdPickerEvent(data) && data.type === 'FWD_PICKER_CLOSED';
}

/**
 * Check if event is an error event.
 */
export function isFwdPickerErrorEvent(data: unknown): data is FwdPickerErrorEvent {
  return isFwdPickerEvent(data) && data.type === 'FWD_PICKER_ERROR';
}
