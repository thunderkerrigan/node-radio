import {Server as IOServer} from "socket.io";
import express from "express";
import http from "http";
import  { Queue } from "./Queue";

const PORT = 3000;
const app = express();
const server = http.createServer(app);
const io = new IOServer(server);
const queue = new Queue();
const url = `${__dirname}/playlists`;
console.log(url);

(async () => {
    await queue.loadTracks(url);
    queue.play();

    io.on("connection", (socket) => {
        console.log("New listener connected");
    
        // Every new streamer must receive the header
        if (queue.bufferHeader) {
            socket.emit("bufferHeader", queue.bufferHeader);
        }
    
        socket.on("bufferHeader", (header) => {
            queue.bufferHeader = header;
            socket.broadcast.emit("bufferHeader", queue.bufferHeader);
        });
    
        socket.on("stream", (packet) => {
            // Only broadcast microphone if a header has been received
            if (!queue.bufferHeader) return;
    
            // Audio stream from host microphone
            socket.broadcast.emit("stream", packet);
        });
    
        socket.on("control", (command) => {
            switch (command) {
                case "pause":
                    queue.pause();
                    break;
                case "resume":
                    queue.resume();
                    break;
            }
        });
    });
    
    

    app.get("/radio", (req, res) => {
        const { id, throttle } = queue.addClient();

        res.set({
            "Content-Type": "audio/mp3",
            "Transfer-Encoding": "chunked",
        }).status(200);

        throttle.pipe(res);

        req.on("close", () => {
            queue.removeClient(id);
        });
    });

    server.listen(PORT, () => {
        console.log(`Listening on port ${PORT}`);
    });
})();