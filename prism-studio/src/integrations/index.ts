// The connector registry. A platform without a connector here stays manual (the Upload Desk).
import type { Platform, PlatformConnector } from "./types";
import { youtube } from "./youtube";
import { tiktok } from "./tiktok";
import { instagram } from "./instagram";

export const CONNECTORS: Partial<Record<Platform, PlatformConnector>> = { youtube, tiktok, instagram };

export const connectorFor = (platform: Platform): PlatformConnector | null => CONNECTORS[platform] ?? null;
