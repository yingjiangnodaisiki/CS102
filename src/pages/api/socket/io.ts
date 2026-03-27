import type { NextApiRequest, NextApiResponse } from "next";
import type { Socket } from "net";
import type { Server as HttpServer } from "http";
import { Server as IOServer } from "socket.io";
import { verifyAccessToken } from "@/lib/utils/jwt";

interface SocketServer extends HttpServer {
  io?: IOServer;
}

interface SocketWithServer extends Socket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithServer;
}

export const config = {
  api: {
    bodyParser: false
  }
};

export default function handler(_: NextApiRequest, res: NextApiResponseWithSocket): void {
  if (res.socket.server.io) {
    res.status(200).json({ code: "SUCCESS", data: { initialized: true } });
    return;
  }

  const io = new IOServer(res.socket.server, {
    path: "/api/socket/io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.use((socket, next) => {
    try {
      const rawToken = socket.handshake.auth?.token;
      if (typeof rawToken !== "string" || rawToken.length === 0) {
        next(new Error("AUTH_REQUIRED"));
        return;
      }
      const payload = verifyAccessToken(rawToken);
      socket.data.userId = payload.userId;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error("AUTH_INVALID"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) {
      socket.disconnect(true);
      return;
    }
    socket.join(`user:${userId}`);
    socket.emit("socket.ready", { connected: true, userId });
  });

  res.socket.server.io = io;
  global.ioServer = io;
  res.status(200).json({ code: "SUCCESS", data: { initialized: true } });
}
