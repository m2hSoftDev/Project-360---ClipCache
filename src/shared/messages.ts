/**
 * Typed messaging protocol between Side Panel, Background Service Worker,
 * and Content Scripts.
 */

import { CaptureMode } from './types';

export type MessageType =
  | 'CAPTURE_REQUEST'
  | 'CAPTURE_RESPONSE'
  | 'GET_STATUS_REQUEST'
  | 'GET_STATUS_RESPONSE';

export interface BaseMessage {
  type: MessageType;
}

export interface CaptureRequestMessage extends BaseMessage {
  type: 'CAPTURE_REQUEST';
  mode: CaptureMode;
}

export interface CaptureResponseMessage extends BaseMessage {
  type: 'CAPTURE_RESPONSE';
  success: boolean;
  screenshotId?: number;
  error?: string;
}

export interface GetStatusRequestMessage extends BaseMessage {
  type: 'GET_STATUS_REQUEST';
}

export interface GetStatusResponseMessage extends BaseMessage {
  type: 'GET_STATUS_RESPONSE';
  count: number;
  limit: number;
  isPaid: boolean;
}

export type ExtensionMessage =
  | CaptureRequestMessage
  | CaptureResponseMessage
  | GetStatusRequestMessage
  | GetStatusResponseMessage;
