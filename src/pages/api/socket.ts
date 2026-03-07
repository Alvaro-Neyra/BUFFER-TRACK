import { Server } from "socket.io";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function SocketHandler(_req: any, res: any) {
    if (res.socket.server.io) {
        console.log("Socket is already running");
    } else {
        console.log("Socket is initializing");
        const io = new Server(res.socket.server, {
            path: "/api/socket",
            addTrailingSlash: false,
        });
        res.socket.server.io = io;

        io.on("connection", (socket) => {
            socket.on("pin-created", (msg) => {
                socket.broadcast.emit("update-pins", msg);
            });
            socket.on("pin-updated", (msg) => {
                socket.broadcast.emit("update-pins", msg);
            });
        });
    }
    res.end();
}
