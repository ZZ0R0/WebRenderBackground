// website/static/js/matrix.js

const config = {
  font: 'monospace',
  backgroundColor: [0, 0, 1],          // [R, G, B]
  color: [0, 255, 0],                  // [R, G, B]
  interval: 50,                        // Controlled delay between ticks (in ms)
  columnWidth: 20,                     // Width of each column
  fontSize: Math.floor(20 * 0.75),     // Font size based on columnWidth
  maxQueueSize: 10,                    // Maximum allowed frames in queue per column
  tileHeight: Math.floor(20 * 0.75)    // Height of each tile based on fontSize
};

class Matrix {
  constructor(backgroundCanvasId, matrixCanvasId, imagePath) {
    console.log('Matrix constructor called');
    this.sample = imagePath;

    // Background canvas setup
    this.backgroundCanvas = document.getElementById(backgroundCanvasId);
    if (!this.backgroundCanvas) {
      console.error(`Background canvas with ID '${backgroundCanvasId}' not found.`);
      return;
    }
    this.backgroundCtx = this.backgroundCanvas.getContext('2d');

    // Foreground (matrix) canvas setup
    this.canvas = document.getElementById(matrixCanvasId);
    if (!this.canvas) {
      console.error(`Matrix canvas with ID '${matrixCanvasId}' not found.`);
      return;
    }
    this.ctx = this.canvas.getContext('2d');

    this.workers = [];
    this.matrixData = [];
    this.cols = 0;
    this.rows = 0;

    // Queues to store frames from each column
    this.frameQueues = [];

    // Keep track of pending frames after requesting updates
    this.pendingFrames = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.processImageAndInitialize();
  }

  resize() {
    console.log('Resizing canvases');
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Resize both canvases
    this.backgroundCanvas.width = width;
    this.backgroundCanvas.height = height;
    this.canvas.width = width;
    this.canvas.height = height;

    this.cols = Math.floor(width / config.columnWidth) + 1;
    this.rows = Math.floor(height / config.fontSize) + 1;
    const bgColorString = `rgb(${config.backgroundColor.join(',')})`;

    // Clear and fill background canvas
    this.loadBackgroundData();

    // Clear foreground canvas
    this.ctx.clearRect(0, 0, width, height);

    console.log(`Canvas resized to ${width}x${height} with ${this.cols} columns and ${this.rows} rows`);
  }

  /**
   * Load the background image and draw it on the background canvas.
   */
  async loadBackgroundData() {
    const imagePath = this.sample;
    const allowedExtensions = ['.jpg', '.jpeg'];

    // Extract the file extension
    const fileExtension = imagePath.substring(imagePath.lastIndexOf('.')).toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      console.error(`Unsupported image format: ${fileExtension}. Please use .jpg or .jpeg files.`);
      return;
    }

    console.log('Loading background image');
    const img = new Image();
    img.src = imagePath;
    img.onload = () => {
      console.log('Background image loaded successfully.');
      this.backgroundCtx.drawImage(img, 0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
    };
    img.onerror = (error) => {
      console.error('Failed to load background image:', error);
    };
  }

  /**
   * Process the background image to generate matrix data.
   */
  async processImageAndInitialize() {
    const imagePath = this.sample;
    const allowedExtensions = ['.jpg', '.jpeg'];

    // Extract the file extension
    const fileExtension = imagePath.substring(imagePath.lastIndexOf('.')).toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      console.error(`Unsupported image format: ${fileExtension}. Please use .jpg or .jpeg files.`);
      return;
    }

    try {
      const img = new Image();
      img.src = imagePath;
      await img.decode(); // Wait for the image to load

      // Create a temporary canvas to draw and process the image
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = this.canvas.width;
      tempCanvas.height = this.canvas.height;
      tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);

      // Extract pixel data
      const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const pixels = imageData.data; // Uint8ClampedArray

      // Process pixels to generate matrixData
      this.matrixData = this.generateMatrixData(pixels, tempCanvas.width, tempCanvas.height);
      console.log('Matrix data generated successfully.');

      // Initialize workers and start animation
      this.initWorkers();
      this.start();
    } catch (error) {
      console.error('Error processing image:', error);
    }
    
  }

  /**
    * Generate matrix data from pixel array by averaging colors in tile portions.
    * @param {Uint8ClampedArray} pixels - The pixel data array.
    * @param {number} width - Width of the canvas.
    * @param {number} height - Height of the canvas.
    * @returns {Array} - Generated matrix data with average colors per tile.
    */
  generateMatrixData(pixels, width, height) {
    const matrixData = [];
    const tileWidth = config.columnWidth;
    const tileHeight = config.tileHeight;

    const cols = this.cols;
    const rows = Math.floor(height / tileHeight);
    this.rows = rows; // Update the rows property

    for (let i = 0; i < cols; i++) {
      matrixData[i] = []; // Initialize the column
      const xStart = i * tileWidth;
      const xEnd = Math.min(xStart + tileWidth, width);

      for (let j = 0; j < rows; j++) {
        let totalR = 0, totalG = 0, totalB = 0, count = 0;
        const yStart = j * tileHeight;
        const yEnd = Math.min(yStart + tileHeight, height);

        for (let y = yStart; y < yEnd; y++) {
          for (let x = xStart; x < xEnd; x++) {
            const pixelIndex = (y * width + x) * 4; // [R, G, B, A]

            // Ensure pixelIndex is within bounds
            if (pixelIndex + 2 < pixels.length) {
              const r = pixels[pixelIndex];
              const g = pixels[pixelIndex + 1];
              const b = pixels[pixelIndex + 2];

              totalR += r;
              totalG += g;
              totalB += b;
              count++;
            }
          }
        }

        if (count === 0) {
          // Avoid division by zero
          matrixData[i][j] = [config.color[0], config.color[1], config.color[2]];
          console.warn(`Tile (${i}, ${j}): No pixels found. Using default color.`);
        } else {
          // Compute average color
          const avgR = Math.floor(totalR / count);
          const avgG = Math.floor(totalG / count);
          const avgB = Math.floor(totalB / count);

          matrixData[i][j] = [avgR, avgG, avgB];
          // Uncomment for debugging:
          // console.log(`Tile (${i}, ${j}): Avg R=${avgR}, Avg G=${avgG}, Avg B=${avgB}`);
        }
      }
    }

    return matrixData;
  }

  /**
   * Initialize Web Workers for each column.
   */
  initWorkers() {
    console.log('Initializing workers');
    for (let i = 0; i < this.cols; i++) {
      const worker = new Worker('static/js/columnWorker.js');
      worker.onmessage = (e) => {
        const { type, columnIndex, frameData } = e.data;
        if (type === 'frame') {
          // Push the new frame data into the column's queue
          this.frameQueues[columnIndex].push(frameData);

          // Decrement pending frames and check if all have been received
          this.pendingFrames--;
          if (this.pendingFrames === 0) {
            // All requested frames have arrived, now draw
            this.draw();
            // After drawing, wait config.interval ms then schedule next update cycle
            setTimeout(() => {
              requestAnimationFrame(() => this.updateCycle());
            }, config.interval);
          }
        }
      };

      const colorData = this.matrixData[i]; // Array of colors per tile in column i

      worker.postMessage({
        type: 'init',
        payload: {
          columnIndex: i,
          config,
          colorData: colorData, // Pass array of colors per tile
          canvasHeight: this.canvas.height
        }
      });

      this.workers.push(worker);
      // Initialize an empty queue for this column
      this.frameQueues.push([]);
    }
  }

  /**
   * Requests frames from all workers that have space in their queues.
   */
  requestFrames() {
    this.pendingFrames = 0;
    for (let i = 0; i < this.cols; i++) {
      // Only request update if the queue isn't full
      if (this.frameQueues[i].length < config.maxQueueSize) {
        this.workers[i].postMessage({ type: 'update' });
        this.pendingFrames++;
      } else {
        console.warn(`Queue for column ${i} is full. Pausing updates.`);
      }
    }
  }

  /**
   * Draws the frames accumulated from all workers onto the canvas.
   */
  draw() {
    // Completely clear the foreground canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.font = `${config.fontSize}px ${config.font}`;

    // For each column, pop one frame from the queue and draw it
    for (let i = 0; i < this.cols; i++) {
      const frameData = this.frameQueues[i].shift();
      if (frameData) {
        frameData.forEach((pixel) => {
          const colorString = `rgb(${pixel.color.join(',')})`; // Use rgb
          this.ctx.fillStyle = colorString;
          this.ctx.fillText(pixel.char, i * config.columnWidth, pixel.y);
        });
      }
    }

    // Optionally draw counts or other info
    // this.drawCounts();
  }

  updateCycle() {
    // Attempt to request frames from workers
    this.requestFrames();
  }

  start() {
    console.log('Starting synchronized animation');
    // Start the cycle
    setTimeout(() => {
      requestAnimationFrame(() => this.updateCycle());
    }, config.interval);
  }
}

// Initialize the Matrix animation on window load
window.onload = () => {
  const matrix = new Matrix('backgroundCanvas', 'matrixCanvas', 'static/images/castle.jpg');
};