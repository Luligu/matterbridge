import type { WsMessage, WsMessageApiResponse } from '../../../../packages/types/src/frontendTypes';

// Keep this shim type-only for shared package exports.
// Frontend runtime helpers should stay local to avoid exposing package internals.
export type {
  WsMessageApiResponse,
  WsMessageApiRequest,
  WsMessageApiStateUpdate,
  WsMessageApiClustersResponse,
  WsMessageApiDevicesRequest,
  WsMessageErrorApiResponse,
  ApiSettings,
  ApiSelectDevice,
  ApiSelectDeviceEntity,
  ApiSelectEntity,
  WsMessage,
} from '../../../../packages/types/src/frontendTypes';
export type { ApiPlugin, ApiDevice, ApiClusters, ApiMatter, MatterbridgeInformation, SystemInformation, Cluster } from '../../../../packages/types/src/matterbridgeTypes';

// Duplicated locally on purpose: these values are used at runtime by the frontend.
export const NODE_STORAGE_DIR = 'storage';
export const MATTER_STORAGE_DIR = 'matterstorage';

// Duplicated locally on purpose: this is only a frontend type guard.
export function isApiResponse(msg: WsMessage): msg is WsMessageApiResponse {
  return msg.id !== 0 && msg.src === 'Matterbridge' && msg.dst === 'Frontend';
}
