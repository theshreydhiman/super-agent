import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { config } from './config';
import { createLogger } from './utils/logger';

const log = createLogger('Socket');

let io: SocketServer | null = null;

export function initSocket(httpServer: HttpServer): SocketServer {
    io = new SocketServer(httpServer, {
        cors: {
            origin: config.dashboard.url || 'http://localhost:5173',
            credentials: true,
        },
    });

    io.on('connection', (socket) => {
        log.info(`Client connected: ${socket.id}`);
        socket.on('disconnect', () => {
            log.info(`Client disconnected: ${socket.id}`);
        });
    });

    log.info('Socket.IO initialized');
    return io;
}

export function getIO(): SocketServer | null {
    return io;
}

// Emit helpers for typed events
export function emitIssueUpdate(data: {
    issueNumber: number;
    repo: string;
    status: string;
    title?: string;
    branchName?: string | null;
    prNumber?: number | null;
    prUrl?: string | null;
    error?: string | null;
}) {
    io?.emit('issue:update', data);
}

export function emitStatsUpdate(data: {
    totalIssues: number;
    successCount: number;
    failedCount: number;
    prsCreated: number;
}) {
    io?.emit('stats:update', data);
}
