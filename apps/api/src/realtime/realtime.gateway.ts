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

@WebSocketGateway({ namespace: '/realtime', cors: { origin: '*' } })
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  afterInit(server: Server) {
    this.logger.log('Realtime gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token || this.extractAuthHeader(client);
      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify(token as string);
      const userId = (payload as any).sub as string;
      if (!userId) {
        client.disconnect(true);
        return;
      }

      client.data.userId = userId;
      client.join(this.roomForUser(userId));
      this.logger.log(`Client connected: ${client.id} user=${userId}`);
    } catch (err) {
      this.logger.warn(`Socket auth failed: ${String(err)}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id} user=${client.data?.userId}`);
  }

  emitToUsers(event: string, payload: any, userIds: string[]) {
    for (const id of userIds) {
      this.server.to(this.roomForUser(id)).emit(event, payload);
    }
  }

  private roomForUser(userId: string) {
    return `user:${userId}`;
  }

  private extractAuthHeader(client: Socket) {
    const header = client.handshake.headers?.authorization as string | undefined;
    if (!header) return null;
    if (header.startsWith('Bearer ')) return header.split(' ')[1];
    return header;
  }
}
