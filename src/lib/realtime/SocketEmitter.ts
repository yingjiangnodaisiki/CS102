import type { Server as IOServer } from "socket.io";

declare global {
  // eslint-disable-next-line no-var
  var ioServer: IOServer | undefined;
}

export function emitSocketToUser(
  userId: string,
  event: string,
  payload: Record<string, unknown>
): void {
  global.ioServer?.to(`user:${userId}`).emit(event, payload);
}
