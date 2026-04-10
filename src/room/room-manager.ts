import { Peer } from 'peerjs';
import type { DataConnection, MediaConnection } from 'peerjs';
import type { SliderState, LorenzState } from '../types';

export type RoomRole = 'solo' | 'host' | 'guest';

interface StateMessage {
  type: 'state';
  sliders: SliderState;
  lorenz: LorenzState;
}

interface SliderMessage {
  type: 'slider';
  sliders: SliderState;
}

type RoomMessage = StateMessage | SliderMessage;

export interface RoomCallbacks {
  onSliderChange: (state: SliderState) => void;
  onStateSync: (sliders: SliderState, lorenz: LorenzState) => void;
  onAudioStream: (stream: MediaStream) => void;
  onPeerCountChange: (count: number) => void;
  onError: (message: string) => void;
}

const PEER_PREFIX = 'music-lounge-';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // No I, L, O (avoid confusion)
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Manages peer-to-peer room connections using PeerJS/WebRTC.
 *
 * Host: runs Lyria, streams audio to guests, broadcasts state.
 * Guest: receives audio stream + state from host, sends slider changes.
 */
export class RoomManager {
  private peer: Peer | null = null;
  private dataConns: DataConnection[] = [];
  private mediaConns: MediaConnection[] = [];
  private _role: RoomRole = 'solo';
  private _roomCode = '';
  private callbacks: Partial<RoomCallbacks> = {};
  private audioStream: MediaStream | null = null;
  private lastBroadcast = 0;
  private broadcastInterval = 100; // ms (~10 Hz)

  get role(): RoomRole { return this._role; }
  get roomCode(): string { return this._roomCode; }
  get isHost(): boolean { return this._role === 'host'; }
  get isGuest(): boolean { return this._role === 'guest'; }
  get peerCount(): number { return this.dataConns.length; }

  setCallbacks(cbs: Partial<RoomCallbacks>): void {
    this.callbacks = cbs;
  }

  setAudioStream(stream: MediaStream): void {
    this.audioStream = stream;
    // Send to any already-connected guests
    for (const conn of this.dataConns) {
      this.callGuest(conn.peer);
    }
  }

  async createRoom(): Promise<string> {
    this._role = 'host';
    this._roomCode = generateRoomCode();

    await this.initPeer(PEER_PREFIX + this._roomCode);

    this.peer!.on('connection', (conn: DataConnection) => {
      conn.on('open', () => {
        this.dataConns.push(conn);
        conn.on('data', (data: unknown) => this.handleMessage(data as RoomMessage, conn));
        conn.on('close', () => this.removeDataConn(conn));
        this.callbacks.onPeerCountChange?.(this.dataConns.length);

        // Send audio stream to new guest after short delay for connection setup
        if (this.audioStream) {
          setTimeout(() => this.callGuest(conn.peer), 300);
        }
      });
    });

    return this._roomCode;
  }

  async joinRoom(code: string): Promise<void> {
    this._role = 'guest';
    this._roomCode = code.toUpperCase().trim();

    await this.initPeer();

    // Listen for audio calls from host
    this.peer!.on('call', (call: MediaConnection) => {
      call.answer(); // No local stream — we only receive
      call.on('stream', (stream: MediaStream) => {
        this.callbacks.onAudioStream?.(stream);
      });
      this.mediaConns.push(call);
    });

    // Connect data channel to host
    return new Promise<void>((resolve, reject) => {
      const conn = this.peer!.connect(PEER_PREFIX + this._roomCode, { reliable: true });

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout — check room code'));
      }, 10000);

      conn.on('open', () => {
        clearTimeout(timeout);
        this.dataConns.push(conn);
        conn.on('data', (data: unknown) => this.handleMessage(data as RoomMessage, conn));
        conn.on('close', () => {
          this.callbacks.onError?.('Host disconnected');
        });
        resolve();
      });

      conn.on('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * Host broadcasts current state to all guests (rate-limited).
   */
  broadcastState(sliders: SliderState, lorenz: LorenzState): void {
    if (!this.isHost || this.dataConns.length === 0) return;

    const now = Date.now();
    if (now - this.lastBroadcast < this.broadcastInterval) return;
    this.lastBroadcast = now;

    const msg: StateMessage = { type: 'state', sliders, lorenz };
    for (const conn of this.dataConns) {
      if (conn.open) conn.send(msg);
    }
  }

  /**
   * Send slider change to peers (guest → host, or host → guests).
   */
  sendSliderChange(sliders: SliderState): void {
    if (this._role === 'solo') return;
    const msg: SliderMessage = { type: 'slider', sliders };
    for (const conn of this.dataConns) {
      if (conn.open) conn.send(msg);
    }
  }

  destroy(): void {
    for (const conn of this.dataConns) conn.close();
    for (const conn of this.mediaConns) conn.close();
    this.peer?.destroy();
    this.peer = null;
    this.dataConns = [];
    this.mediaConns = [];
    this._role = 'solo';
    this._roomCode = '';
  }

  private async initPeer(id?: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.peer = id ? new Peer(id) : new Peer();

      this.peer.on('open', () => resolve());
      this.peer.on('error', (err: any) => {
        if (err.type === 'unavailable-id') {
          reject(new Error('Room code in use — try again'));
        } else if (err.type === 'peer-unavailable') {
          reject(new Error('Room not found — check the code'));
        } else {
          reject(new Error(err.message || 'Connection failed'));
        }
      });
    });
  }

  private callGuest(peerId: string): void {
    if (!this.audioStream || !this.peer) return;
    const call = this.peer.call(peerId, this.audioStream);
    if (call) this.mediaConns.push(call);
  }

  private handleMessage(msg: RoomMessage, from: DataConnection): void {
    if (msg.type === 'slider' && msg.sliders) {
      this.callbacks.onSliderChange?.(msg.sliders);
      // Host re-broadcasts to other guests
      if (this.isHost) {
        for (const conn of this.dataConns) {
          if (conn !== from && conn.open) {
            conn.send(msg);
          }
        }
      }
    }
    if (msg.type === 'state' && msg.sliders && msg.lorenz) {
      this.callbacks.onStateSync?.(msg.sliders, msg.lorenz);
    }
  }

  private removeDataConn(conn: DataConnection): void {
    this.dataConns = this.dataConns.filter(c => c !== conn);
    this.callbacks.onPeerCountChange?.(this.dataConns.length);
  }
}
