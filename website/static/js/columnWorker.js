// columnWorker.js

let columnIndex;
let config;
let colorData; // Array of colors per tile
let canvasHeight;
let numberOfPixels;
let maxPixelPosition;
let activePixel = 0;
let pixels = [];
let length;

self.onmessage = (e) => {
  const { type, payload } = e.data;
  if (type === 'init') {
    columnIndex = payload.columnIndex;
    config = payload.config;
    colorData = payload.colorData; // Now an array of colors per tile
    canvasHeight = payload.canvasHeight;

    const fontSize = config.fontSize;
    numberOfPixels = Math.floor(canvasHeight / fontSize);

    // Initialize pixels
    for (let i = 0; i < numberOfPixels; i++) {
      const char = String.fromCharCode(Math.floor(Math.random() * 128));
      const cData = colorData && colorData[i] ? colorData[i] : config.color; // [R,G,B] per tile
      pixels.push({ "char": char, "color": cData });
    }

    resetPosition();
  } else if (type === 'update') {
    updateColumn();
  }
};

function resetPosition() {
  activePixel = 0;
  length = Math.floor(numberOfPixels * (1 / 4) * (1 + Math.random()));
  maxPixelPosition = Math.floor(numberOfPixels * (0.1 + Math.random()));
}

function saturatePixel(pixel, saturation) {
  let r = pixel[0];
  let g = pixel[1];
  let b = pixel[2];

  // Normalize to [0,1]
  let R = r / 255;
  let G = g / 255;
  let B = b / 255;

  // Convert RGB to HSV
  let maxVal = Math.max(R, G, B);
  let minVal = Math.min(R, G, B);
  let delta = maxVal - minVal;

  let H, S, V = maxVal;

  if (delta === 0) {
    H = 0;
  } else if (maxVal === R) {
    H = ((G - B) / delta) % 6;
  } else if (maxVal === G) {
    H = ((B - R) / delta) + 2;
  } else {
    H = ((R - G) / delta) + 4;
  }

  S = maxVal === 0 ? 0 : delta / maxVal;

  // Adjust saturation
  S *= saturation;

  // Convert HSV back to RGB
  let C = V * S;
  let X = C * (1 - Math.abs((H % 2) - 1));
  let m = V - C;

  let [r1, g1, b1] = [0, 0, 0];

  if (0 <= H && H < 1) {
    [r1, g1, b1] = [C, X, 0];
  } else if (1 <= H && H < 2) {
    [r1, g1, b1] = [X, C, 0];
  } else if (2 <= H && H < 3) {
    [r1, g1, b1] = [0, C, X];
  } else if (3 <= H && H < 4) {
    [r1, g1, b1] = [0, X, C];
  } else if (4 <= H && H < 5) {
    [r1, g1, b1] = [X, 0, C];
  } else {
    [r1, g1, b1] = [C, 0, X];
  }

  let newR = Math.floor((r1 + m) * 255);
  let newG = Math.floor((g1 + m) * 255);
  let newB = Math.floor((b1 + m) * 255);

  return [newR, newG, newB];
}

function updateColumn() {
  if (activePixel > maxPixelPosition || activePixel >= pixels.length) {
    resetPosition();
  }

  let start = activePixel - length;
  let startOnScreen = Math.max(0, start);
  let limit = (activePixel + start) / 2;
  const frameData = [];

  for (let pos = startOnScreen; pos < activePixel && pos < pixels.length; pos++) {
    const pixel = pixels[pos];
    const newChar = String.fromCharCode(Math.floor(Math.random() * 128));
    let baseColor = pixel.color;
    let newColor = baseColor;

    if (pos < limit) {
      let gradient = (pos - start) / (limit - start);
      newColor = saturatePixel(baseColor, gradient+1);
      newColor[3] = 255 * gradient;
    } else {
      let gradient = ((activePixel - pos) / (activePixel - limit) + 1);
      newColor = saturatePixel(baseColor, gradient);
      newColor[3] = 1;
    }

    frameData.push({
      char: newChar,
      color: newColor,
      y: pos * config.fontSize
    });
  }

  activePixel++;
  self.postMessage({ type: 'frame', columnIndex, frameData });
}
