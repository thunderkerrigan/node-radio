import { readdir } from "fs/promises";
import { extname, join } from "path";
import { ffprobe } from "@dropb/ffprobe";
import ffprobeStatic from "ffprobe-static";
import Throttle, { PassThrough } from "throttle";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

ffprobe.path = ffprobeStatic.path;

type music = { filepath: string, bitrate: number };

export class Queue {
    clients: Map<string, Throttle>;
    tracks: music[];
    index: number = 0;
    currentTrack?: music;
    stream?: fs.ReadStream
    playing: boolean = false;
    throttle?: Throttle
    bufferHeader?: Buffer



    constructor() {
        this.clients = new Map();
        this.tracks = [];
    }

    async loadTracks(dir: string) {
        let filenames = await readdir(dir);
        filenames = filenames.filter(
            (filename) => extname(filename) === ".mp3"
        );

        // Add directory name back to filenames
        const filepaths = filenames.map((filename) => join(dir, filename));

        const promises = filepaths.map(async (filepath) => {
            const bitrate = await this.getTrackBitrate(filepath);

            return { filepath, bitrate };
        });

        this.tracks = await Promise.all(promises);
        console.log(`Loaded ${this.tracks.length} tracks`);
    }

    addClient() {
        const track = this.currentTrack;
        const id = uuidv4();
        const throttle = new Throttle(track ? track.bitrate : 128000 / 8);
        this.clients.set(id, throttle);
        return { id, throttle };
    }

    removeClient(id: string) {
        this.clients.delete(id);
    }

    broadcast(chunk: Buffer) {
        this.clients.forEach((client) => {
            client.write(chunk);
        });
    }

    loadTrackStream() {
        const track = this.currentTrack;
        if (!track) return;
    
        console.log("Starting audio stream");
        this.stream = fs.createReadStream(track.filepath);
    }

    getNextTrack() {
        // Loop back to the first track
        if (this.index >= this.tracks.length) {
            this.index = 0;
        }
    
        const track = this.tracks[this.index++];
        this.currentTrack = track;
    
        return track;
    }
    
    async getTrackBitrate(filepath: string) {
        const data = await ffprobe(filepath);
        const bitrate = data?.format?.bit_rate;

        return bitrate ? parseInt(bitrate) : 128000;
    }

    pause() {
        if (!this.started() || !this.playing) return;
        this.playing = false;
        console.log("Paused");
        this.throttle?.removeAllListeners("end");
        this.throttle?.end();
    }

    async start() {
        const track = this.currentTrack;
        if (!track) return;
    
        this.playing = true;
        console.log("Start");
        this.throttle = new Throttle(track.bitrate / 8);
    
        this.stream?.pipe(this.throttle)
            .on("data", (chunk) => this.broadcast(chunk))
            .on("end", () => this.play(true))
            .on("error", () => this.play(true));
    }
    

    
    started() {
        return this.stream && this.throttle && this.currentTrack;
    }
    

    resume() {
        if (!this.started() || this.playing) return;
        console.log("Resumed");
        this.start();
    }
    

    play(useNewTrack = false) {
        if (useNewTrack || !this.currentTrack) {
            console.log("Playing new track");
            this.getNextTrack();
            this.loadTrackStream();
            this.start();
        } else {
            this.resume();
        }
    }
}


const queue = new Queue();
export default queue;