interface imageConfusion {
  imageData: ImageData; // 图像数据
}

export function imageConfusion(imageData: ImageData): ArrayBuffer {

  // 类型检查
  if (!(imageData instanceof ImageData)) {
    const type = typeof imageData;
    throw new Error(`入参 imageData 类型错误。入参类型应该是：ImageData，实际类型却是：${type}`);
  }

  const { width, height, data } = imageData;
  const lastPixelIndex = (width * (height - 1) + (width - 1)) * 4;
  const leftPixelIndex = (width * (height - 1) + (width - 2)) * 4;

  // 获取右下角像素的 RGBA 值
  const r = data[lastPixelIndex];
  const g = data[lastPixelIndex + 1];
  const b = data[lastPixelIndex + 2];
  const a = data[lastPixelIndex + 3];

  // 获取右下角左边一个像素的 RGBA 值
  const leftR = data[leftPixelIndex];
  const leftG = data[leftPixelIndex + 1];
  const leftB = data[leftPixelIndex + 2];
  const leftA = data[leftPixelIndex + 3];

  // 交换右下角像素和左边一个像素的 RGBA 值
  data[lastPixelIndex] = leftR;
  data[lastPixelIndex + 1] = leftG;
  data[lastPixelIndex + 2] = leftB;
  data[lastPixelIndex + 3] = leftA;

  data[leftPixelIndex] = r;
  data[leftPixelIndex + 1] = g;
  data[leftPixelIndex + 2] = b;
  data[leftPixelIndex + 3] = a;

  // 返回 ArrayBuffer
  return data.buffer;
}
