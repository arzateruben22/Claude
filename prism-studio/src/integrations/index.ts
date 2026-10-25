// The connector registry. A platform without a connector here stays manual (the Upload Desk).
import type { Platform, PlatformConnector } from "./types";

export const CONNECTORS: Partial<Record<Platform, PlatformConnector>> = {};

export const connectorFor = (platform: Platform): PlatformConnector | null => CONNECTORS[platform] ?? null;
