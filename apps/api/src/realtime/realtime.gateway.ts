import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

type SocketSessionData = {
  userId?: string;
};

type RealtimeSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  SocketSessionData
>;

@WebSocketGateway({ namespace: '/realtime', cors: { origin: '*' } })
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  afterInit() {
    this.logger.log('Realtime gateway initialized');
  }

  handleConnection(client: RealtimeSocket) {
    try {
      const token = this.extractSocketToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload: unknown = this.jwtService.verify(token);
      const userId = this.extractUserId(payload);
      if (!userId) {
        client.disconnect(true);
        return;
      }

      client.data.userId = userId;
      void client.join(this.roomForUser(userId));
      this.logger.log(`Client connected: ${client.id} user=${userId}`);
    } catch (err) {
      this.logger.warn(`Socket auth failed: ${String(err)}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: RealtimeSocket) {
    this.logger.log(
      `Client disconnected: ${client.id} user=${client.data?.userId}`,
    );
  }

  emitToUsers(event: string, payload: unknown, userIds: string[]) {
    for (const id of userIds) {
      this.server.to(this.roomForUser(id)).emit(event, payload);
    }
  }

  private roomForUser(userId: string) {
    return `user:${userId}`;
  }

  private extractSocketToken(client: RealtimeSocket): string | null {
    const auth = client.handshake.auth;
    if (typeof auth === 'object' && auth !== null) {
      const token = (auth as Record<string, unknown>).token;
      if (typeof token === 'string' && token.trim().length > 0) {
        return token;
      }
    }

    return this.extractAuthHeader(client);
  }

  private extractUserId(payload: unknown): string | null {
    if (typeof payload !== 'object' || payload === null) {
      return null;
    }

    const subject = (payload as Record<string, unknown>).sub;
    if (typeof subject !== 'string' || subject.trim().length === 0) {
      return null;
    }

    return subject;
  }

  private extractAuthHeader(client: RealtimeSocket): string | null {
    const header = client.handshake.headers?.authorization;
    if (typeof header !== 'string') {
      return null;
    }

    if (header.startsWith('Bearer ')) {
      return header.split(' ')[1] ?? null;
    }

    return header;
  }
}
