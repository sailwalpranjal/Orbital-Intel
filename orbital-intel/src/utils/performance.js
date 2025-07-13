export class PerformanceMonitor {
  static metrics = {
    frameRate: 0,
    updateTime: 0,
    renderTime: 0,
    satelliteCount: 0
  };

  static frameCounter = 0;
  static lastFrameTime = performance.now();

  static measureFrame() {
    this.frameCounter++;
    const now = performance.now();
    const delta = now - this.lastFrameTime;
    
    if (delta >= 1000) {
      this.metrics.frameRate = Math.round(this.frameCounter * 1000 / delta);
      this.frameCounter = 0;
      this.lastFrameTime = now;
    }
  }

  static measure(name, fn) {
    const start = performance.now();
    const result = fn();
    this.metrics[name] = performance.now() - start;
    return result;
  }

  static getMetrics() {
    return { ...this.metrics };
  }
}