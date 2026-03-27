import { EventEmitter } from "node:events";

const emitter = new EventEmitter();

export interface UserRealtimeEvent<T = Record<string, unknown>> {
  userId: string;
  event: string;
  payload: T;
}

export class RealtimeEventBus {
  static emitToUser<T = Record<string, unknown>>(event: UserRealtimeEvent<T>): void {
    emitter.emit(`user:${event.userId}`, event);
  }

  static subscribeUser(
    userId: string,
    handler: (event: UserRealtimeEvent) => void
  ): () => void {
    const key = `user:${userId}`;
    emitter.on(key, handler);
    return () => emitter.off(key, handler);
  }
}
