import { } from "@quanhuzeyu/koishi-plugin-qhzy-sharp"  // 导入类型声明
const inject = ["QhzySharp"]  // 使用koishi的inject来确保服务加载后再启动本模块


import axios from 'axios';
import { Lolicon } from './Interface';
import stream from 'stream';
import { promisify } from 'util';
import { Context } from "koishi";

const streamPipeline = promisify(stream.pipeline);

async function fetchImageStream(url: string): Promise<NodeJS.ReadableStream> {
  const response = await axios({
    url,
    method: "GET",
    responseType: "stream"
  });
  return response.data;
}

function getImageMimeType(url: string): string {
  const extension = url
    .split(".")
    .pop()
    ?.toLowerCase();
  const typeMap = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif"
  };
  return typeMap[extension] || "application/octet-stream";
}

async function streamToBuffer(stream: NodeJS.ReadableStream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function mixImage(image: Lolicon, ctx: Context): Promise<string> {
  const Sharp = ctx.QhzySharp.Sharp  // 获取原生Sharp
  const imageStream = await fetchImageStream(image.urls.original);

  const imageBuffer = await streamToBuffer(imageStream);
  const { width, height } = await Sharp(imageBuffer).metadata();

  const { data, info } = await Sharp(imageBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const startX = Math.max(0, width - 50);
  const startY = Math.max(0, height - 50);

  for (let y = startY; y < height; y++) {
    for (let x = startX; x < width; x++) {
      const idx = (y * width + x) * info.channels;
      data[idx] = (data[idx] + 10 < 255) ? data[idx] + 10 : 245;
      data[idx + 1] = (data[idx + 1] + 10 < 255) ? data[idx + 1] + 10 : 245;
      data[idx + 2] = (data[idx + 2] + 10 < 255) ? data[idx + 2] + 10 : 245;
    }
  }

  const processedImageBuffer = await Sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels
    }
  }).png().toBuffer();

  console.debug("Image processed");

  return `data:${getImageMimeType(image.urls.original)};base64,${processedImageBuffer.toString("base64")}`;
}
