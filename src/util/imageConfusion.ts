interface imageConfusion {
  imageData: ImageData; // 图像数据
  newX: number; // 新的 X 坐标
  newY: number; // 新的 Y 坐标
}

export function imageConfusion(imageData: ImageData, newX: number, newY: number): ArrayBuffer {
  const { width, height, data } = imageData;
  const lastPixelIndex = (width * (height - 1) + (width - 1)) * 4;

  // 获取右下角像素的 RGBA 值
  const r = data[lastPixelIndex];
  const g = data[lastPixelIndex + 1];
  const b = data[lastPixelIndex + 2];
  const a = data[lastPixelIndex + 3];

  // 计算新像素的索引
  const newPixelIndex = (newY * width + newX) * 4;

  // 获取目标位置像素的 RGBA 值
  const targetR = data[newPixelIndex];
  const targetG = data[newPixelIndex + 1];
  const targetB = data[newPixelIndex + 2];
  const targetA = data[newPixelIndex + 3];

  // 设置新像素的 RGBA 值
  data[newPixelIndex] = r;
  data[newPixelIndex + 1] = g;
  data[newPixelIndex + 2] = b;
  data[newPixelIndex + 3] = a;

  // 用目标位置的 RGBA 值填充原来的右下角像素
  data[lastPixelIndex] = targetR;
  data[lastPixelIndex + 1] = targetG;
  data[lastPixelIndex + 2] = targetB;
  data[lastPixelIndex + 3] = targetA;

  // 返回 ArrayBuffer
  return data.buffer;
}
