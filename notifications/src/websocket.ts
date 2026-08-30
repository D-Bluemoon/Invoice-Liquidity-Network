import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { Server } from "http";
import { v4 as uuidv4 } from "crypto";
import type {
  WebSocketClient,
  WebSocketMessage,
  InvoiceEvent,
  NotificationTrigger,
} from "./types";

const HEARTBEAT_INTERVAL = 30000;
const CLIENT_TIMEOUT = 60000;

// 🔒 Security Thresholds
const GLOBAL_CONNECTION_LIMIT = 1000;
const PER_IP_CONNECTION_LIMIT = 5;
const EXPECTED_AUTH_TOKEN = process.env.NOTIFICATIONS_WS_AUTH_TOKEN || "secure-websocket-token";

export class NotificationWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private ipConnections: Map<string, number> = new Map(); // Track connection counts per IP
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly port: number = 4002) {}

  start(server: Server): void {
    this.wss = new WebSocketServer({ 
      server, 
      path: "/ws",
      // 🔐 Authenticate and validate limits before completing the WebSocket handshake
      verifyClient: (info, callback) => {
        const req = info.req;
        const ip = req.socket.remoteAddress || "unknown-ip";

        // 1. Enforce Global Connection Limit
        if (this.clients.size >= GLOBAL_CONNECTION_LIMIT) {
          console.warn(`[websocket] Connection rejected: Global limit reached (${GLOBAL_CONNECTION_LIMIT})`);
          return callback(false, 503, "Service Unavailable: Max connections reached");
        }

        // 2. Enforce Per-IP Connection Limit
        const currentIpCount = this.ipConnections.get(ip) || 0;
        if (currentIpCount >= PER_IP_CONNECTION_LIMIT) {
          console.warn(`[websocket] Connection rejected: IP limit reached for ${ip}`);
          return callback(false, 429, "Too Many Requests: Per-IP limit reached");
        }

        // 3. Enforce Authentication Token Requirements
        const url = new URL(req.url || "", `http://${req.headers.host}`);
        const token = url.searchParams.get("token") || req.headers["x-auth-token"];

        if (!token || token !== EXPECTED_AUTH_TOKEN) {
          console.warn(`[websocket] Connection rejected: Authentication failed from ${ip}`);
          return callback(false, 401, "Unauthorized: Invalid or missing authentication token");
        }

        callback(true);
      }
    });

    this.wss.on("connection", (socket: WebSocket, req: IncomingMessage) => {
      this.handleConnection(socket, req);
    });

    this.heartbeatTimer = setInterval(() => {
      this.checkHeartbeats();
    }, HEARTBEAT_INTERVAL);

    console.log(`[websocket] Hardened WebSocket server listening on port ${this.port}`);
  }

  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.clients.forEach((client) => {
      client.socket.close(1000, "Server shutting down");
    });

    this.clients.clear();
    this.ipConnections.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  broadcastEvent(event: InvoiceEvent): void {
    const message: WebSocketMessage = {
      type: "event",
      payload: event,
      timestamp: Date.now(),
    };

    this.clients.forEach((client) => {
      if (!client.isAlive) return;

      const shouldNotify =
        client.subscribedAddresses.has(event.freelancer) ||
        client.subscribedAddresses.has(event.payer) ||
        (event.funder && client.subscribedAddresses.has(event.funder));

      if (shouldNotify) {
        this.sendToClient(client, message);
      }
    });
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getSubscribedAddresses(): string[] {
    const addresses = new Set<string>();
    this.clients.forEach((client) => {
      client.subscribedAddresses.forEach((addr) => addresses.add(addr));
    });
    return Array.from(addresses);
  }

  private handleConnection(socket: WebSocket, req: IncomingMessage): void {
    const ip = req.socket.remoteAddress || "unknown-ip";
    const clientId = this.generateClientId();
    
    const client: WebSocketClient = {
      id: clientId,
      address: "",
      socket,
      subscribedAddresses: new Set(),
      lastHeartbeat: Date.now(),
      isAlive: true,
    };

    // Increment IP counter
    const currentIpCount = this.ipConnections.get(ip) || 0;
    this.ipConnections.set(ip, currentIpCount + 1);

    this.clients.set(clientId, client);

    socket.on("message", (data: Buffer) => {
      this.handleMessage(client, data.toString());
    });

    socket.on("close", () => {
      this.clients.delete(clientId);
      
      // Decrement IP tracking map securely on disconnection
      const count = this.ipConnections.get(ip) || 1;
      if (count <= 1) {
        this.ipConnections.delete(ip);
      } else {
        this.ipConnections.set(ip, count - 1);
      }
      
      console.log(`[websocket] Client ${clientId} disconnected`);
    });

    socket.on("error", (error: Error) => {
      console.error(`[websocket] Client ${clientId} error:`, error.message);
      this.clients.delete(clientId);
      
      const count = this.ipConnections.get(ip) || 1;
      if (count <= 1) {
        this.ipConnections.delete(ip);
      } else {
        this.ipConnections.set(ip, count - 1);
      }
    });

    socket.on("pong", () => {
      client.isAlive = true;
      client.lastHeartbeat = Date.now();
    });

    this.sendToClient(client, {
      type: "heartbeat",
      payload: { clientId },
      timestamp: Date.now(),
    });

    console.log(`[websocket] Client ${clientId} (${ip}) authenticated and connected successfully`);
  }

  private handleMessage(client: WebSocketClient, data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);

      switch (message.type) {
        case "subscribe":
          this.handleSubscribe(client, message);
          break;
        case "unsubscribe":
          this.handleUnsubscribe(client, message);
          break;
        case "heartbeat":
          client.isAlive = true;
          client.lastHeartbeat = Date.now();
          break;
        default:
          this.sendToClient(client, {
            type: "error",
            payload: { message: `Unknown message type: ${message.type}` },
          });
      }
    } catch (error) {
      this.sendToClient(client, {
        type: "error",
        payload: { message: "Invalid message format" },
      });
    }
  }

  private handleSubscribe(client: WebSocketClient, message: WebSocketMessage): void {
    if (message.address) {
      client.subscribedAddresses.add(message.address);
      console.log(`[websocket] Client ${client.id} subscribed to ${message.address}`);
    }
  }

  private handleUnsubscribe(client: WebSocketClient, message: WebSocketMessage): void {
    if (message.address) {
      client.subscribedAddresses.delete(message.address);
      console.log(`[websocket] Client ${client.id} unsubscribed from ${message.address}`);
    }
  }

  private sendToClient(client: WebSocketClient, message: WebSocketMessage): void {
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify(message));
    }
  }

  private checkHeartbeats(): void {
    const now = Date.now();
    this.clients.forEach((client, id) => {
      if (now - client.lastHeartbeat > CLIENT_TIMEOUT) {
        client.isAlive = false;
        client.socket.terminate();
        // Disconnect handle handles map cleanups
        console.log(`[websocket] Client ${id} timed out and was terminated`);
      }
    });

    this.clients.forEach((client) => {
      if (client.isAlive) {
        client.socket.ping();
      }
    });
  }

  private generateClientId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
