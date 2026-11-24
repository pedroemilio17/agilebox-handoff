export {
  launchAgileBoxSession,
  type AgileBoxSession,
  type GlassMode,
  type LaunchAgileBoxOptions,
  type OpenTrayOptions,
  type WindowBounds,
} from './electron-session'
export {
  expectNoHorizontalOverflow,
  expectNoOverlap,
  expectNotClipped,
  expectTrayDimensions,
  getComputedStyleProp,
  getRect,
  setPanelViewport,
  setTraySize,
  type ElementRect,
  type ExpectTrayDimensionsOptions,
} from './layout-assertions'
export { captureE2EScreenshot, type CaptureScreenshotOptions } from './screenshots'
export {
  AGENDA_LABELS,
  AGILE_LABELS,
  BOARD_LABELS,
  DASHBOARD_LABELS,
  FORBIDDEN_UI_MARKERS,
  KAN_TABS,
  NAV_LABELS,
  NEW_PROJECT_LABELS,
  PREDICTIVE_LABELS,
  SEED_DATA,
  SETTINGS_LABELS,
  TASK_DETAIL_TOPICS,
  TASK_STATUSES_PT,
  TRAY_LABELS,
  TRAY_ROTATING_PHRASES,
  VIEWPORTS,
} from './opaque-contracts'
