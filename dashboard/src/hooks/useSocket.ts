import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

let sharedSocket: Socket | null = null;
let refCount = 0;

function getSocket(): Socket {
    if (!sharedSocket) {
        sharedSocket = io(SOCKET_URL, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
        });
    }
    refCount++;
    return sharedSocket;
}

function releaseSocket() {
    refCount--;
    if (refCount <= 0 && sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
        refCount = 0;
    }
}

/**
 * Subscribe to a Socket.IO event. The callback is stable across re-renders.
 * Automatically connects/disconnects the shared socket based on component lifecycle.
 */
export function useSocketEvent<T = unknown>(event: string, callback: (data: T) => void) {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        const socket = getSocket();

        const handler = (data: T) => {
            callbackRef.current(data);
        };

        socket.on(event, handler);

        return () => {
            socket.off(event, handler);
            releaseSocket();
        };
    }, [event]);
}

/**
 * Returns a refetch function that is called both on mount AND whenever
 * the specified socket event fires. Drop-in enhancement for useFetch.
 */
export function useSocketRefetch(event: string, refetch: () => void) {
    useSocketEvent(event, refetch);
}
