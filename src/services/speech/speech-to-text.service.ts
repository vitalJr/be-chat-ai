import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { env, pipeline } from "@huggingface/transformers";
import { config } from "../../config/env.js";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static") as string | null;

const SAMPLE_RATE = 16000;

env.cacheDir = "./.cache/transformers";

type Transcriber = (
  audio: Float32Array,
  options?: { language?: string; task?: string },
) => Promise<{ text: string } | { text: string }[]>;

let transcriberPromise: Promise<Transcriber> | undefined;

function getTranscriber(): Promise<Transcriber> {
  if (!transcriberPromise) {
    transcriberPromise = pipeline(
      "automatic-speech-recognition",
      config.whisperModel,
    ) as unknown as Promise<Transcriber>;
  }

  return transcriberPromise;
}

function decodeToPcm(buffer: Buffer): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("ffmpeg binary not found (ffmpeg-static)."));
      return;
    }

    const ffmpeg = spawn(ffmpegPath, [
      "-i",
      "pipe:0",
      "-f",
      "f32le",
      "-ar",
      String(SAMPLE_RATE),
      "-ac",
      "1",
      "pipe:1",
    ]);

    const chunks: Buffer[] = [];
    let stderr = "";

    ffmpeg.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    ffmpeg.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
        return;
      }

      const pcm = Buffer.concat(chunks);
      resolve(new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4));
    });

    ffmpeg.stdin.write(buffer);
    ffmpeg.stdin.end();
  });
}

export async function transcribeAudio(buffer: Buffer): Promise<string> {
  const [audio, transcriber] = await Promise.all([
    decodeToPcm(buffer),
    getTranscriber(),
  ]);

  const result = await transcriber(audio, {
    language: config.whisperLanguage,
    task: "transcribe",
  });

  const output = Array.isArray(result) ? result[0] : result;

  return (output?.text ?? "").trim();
}
