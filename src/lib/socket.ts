import { io, Socket } from "socket.io-client";

let socket: Socket;

export const initSocket = () => {
    if (!socket) {
        socket = io(process.env.NEXT_PUBLIC_SITE_URL || "", {
            path: "/api/socket",
        });
    }
    return socket;
};
