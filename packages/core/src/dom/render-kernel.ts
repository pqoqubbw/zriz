export interface KernelPlan {
  width: number;
  height: number;
  forward: readonly number[];
  homography: readonly number[] | null;
}

export interface Drawable {
  drawable: CanvasImageSource;
  width: number;
  height: number;
}

export interface RenderJob {
  source: Blob | ImageBitmap | Drawable;
  image: { width: number; height: number };
  plans: readonly KernelPlan[];
  type: string;
  quality: number;
  colorSpace: PredefinedColorSpace;
  circle: boolean;
}

export interface RenderReply {
  blob: Blob;
  index: number;
}

export interface RenderKernel {
  render: (job: RenderJob) => Promise<RenderReply>;
}

export const renderKernel = (): RenderKernel => {
  type Canvas = OffscreenCanvas | HTMLCanvasElement;
  type Context = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  type M3 = number[];

  const fail = (code: string, message: string): Error =>
    new Error(`zriz:${code}:${message}`);

  const canvasFor = (width: number, height: number): Canvas => {
    if (typeof OffscreenCanvas === "function") {
      return new OffscreenCanvas(width, height);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  };

  const contextOf = (
    canvas: {
      getContext: (
        id: "2d",
        settings: CanvasRenderingContext2DSettings
      ) => Context | null;
    },
    colorSpace: PredefinedColorSpace
  ): Context => {
    const context = canvas.getContext("2d", { colorSpace });
    if (!context) {
      throw fail("decode", "no 2D canvas");
    }
    return context;
  };

  const free = (canvas: Canvas): void => {
    canvas.width = 0;
    canvas.height = 0;
  };

  const multiply = (x: M3, y: M3): M3 => {
    const out: M3 = [];
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        out.push(
          (x[r * 3] ?? 0) * (y[c] ?? 0) +
            (x[r * 3 + 1] ?? 0) * (y[3 + c] ?? 0) +
            (x[r * 3 + 2] ?? 0) * (y[6 + c] ?? 0)
        );
      }
    }
    return out;
  };

  const invert = (m: M3): M3 => {
    const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0, i = 1] = m;
    const A = e * i - f * h;
    const B = -(d * i - f * g);
    const C = d * h - e * g;
    const det = a * A + b * B + c * C;
    return [
      A / det,
      -(b * i - c * h) / det,
      (b * f - c * e) / det,
      B / det,
      (a * i - c * g) / det,
      -(a * f - c * d) / det,
      C / det,
      -(a * h - b * g) / det,
      (a * e - b * d) / det,
    ];
  };

  const project = (m: M3, x: number, y: number): [number, number] => {
    const w = (m[6] ?? 0) * x + (m[7] ?? 0) * y + (m[8] ?? 1);
    return [
      ((m[0] ?? 0) * x + (m[1] ?? 0) * y + (m[2] ?? 0)) / w,
      ((m[3] ?? 0) * x + (m[4] ?? 0) * y + (m[5] ?? 0)) / w,
    ];
  };

  const mesh = (
    context: Context,
    image: CanvasImageSource,
    toOutput: M3
  ): void => {
    const back = invert(toOutput);
    const { width, height } = context.canvas;
    const steps = Math.min(
      64,
      Math.max(24, Math.ceil(Math.max(width, height) / 64))
    );
    const flip = (back[6] ?? 0) * (back[7] ?? 0) > 0;
    const triangle = (
      p: [number, number],
      q: [number, number],
      r: [number, number]
    ): void => {
      const [ax, ay] = project(back, p[0], p[1]);
      const [bx, by] = project(back, q[0], q[1]);
      const [cx, cy] = project(back, r[0], r[1]);
      const det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
      if (Math.abs(det) < 1e-12) {
        return;
      }
      const m11 = ((q[0] - p[0]) * (cy - ay) - (r[0] - p[0]) * (by - ay)) / det;
      const m12 = ((r[0] - p[0]) * (bx - ax) - (q[0] - p[0]) * (cx - ax)) / det;
      const m21 = ((q[1] - p[1]) * (cy - ay) - (r[1] - p[1]) * (by - ay)) / det;
      const m22 = ((r[1] - p[1]) * (bx - ax) - (q[1] - p[1]) * (cx - ax)) / det;
      context.save();
      context.beginPath();
      context.moveTo(...p);
      context.lineTo(...q);
      context.lineTo(...r);
      context.closePath();
      context.clip();
      context.setTransform(
        m11,
        m21,
        m12,
        m22,
        p[0] - m11 * ax - m12 * ay,
        p[1] - m21 * ax - m22 * ay
      );
      context.drawImage(image, 0, 0);
      context.restore();
    };
    context.globalCompositeOperation = "lighter";
    for (let i = 0; i < steps; i += 1) {
      for (let j = 0; j < steps; j += 1) {
        const x0 = (i / steps) * width;
        const x1 = ((i + 1) / steps) * width;
        const y0 = (j / steps) * height;
        const y1 = ((j + 1) / steps) * height;
        if (flip) {
          triangle([x1, y0], [x1, y1], [x0, y1]);
          triangle([x1, y0], [x0, y1], [x0, y0]);
        } else {
          triangle([x0, y0], [x1, y0], [x1, y1]);
          triangle([x0, y0], [x1, y1], [x0, y1]);
        }
      }
    }
    context.globalCompositeOperation = "source-over";
  };

  const dead = (context: Context): boolean => {
    const { width, height } = context.canvas;
    const corners: [number, number][] = [
      [0, 0],
      [width - 1, height - 1],
    ];
    return corners.some(([x, y]) => {
      const kept = context.getImageData(x, y, 1, 1);
      context.fillStyle = "#010203";
      context.fillRect(x, y, 1, 1);
      const { data } = context.getImageData(x, y, 1, 1);
      context.putImageData(kept, x, y);
      return data[3] === 0;
    });
  };

  const smooth = (context: Context): void => {
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
  };

  const paint = (
    canvas: Canvas,
    full: Drawable,
    job: RenderJob,
    plan: KernelPlan
  ): void => {
    const context = contextOf(canvas, job.colorSpace);
    if (dead(context)) {
      throw fail("blank", "the browser drew a blank canvas");
    }
    smooth(context);
    const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = plan.forward;
    let scale =
      (Math.sqrt(Math.abs(a * d - b * c)) * job.image.width) / full.width;
    let small = full;
    const steps: Canvas[] = [];
    try {
      while (scale > 0 && scale < 0.5) {
        const width = Math.ceil(small.width / 2);
        const height = Math.ceil(small.height / 2);
        const step = canvasFor(width, height);
        steps.push(step);
        const half = contextOf(step, job.colorSpace);
        if (dead(half)) {
          break;
        }
        smooth(half);
        half.drawImage(small.drawable, 0, 0, width, height);
        small = { drawable: step, height, width };
        scale *= 2;
      }
      const fx = small.width / job.image.width;
      const fy = small.height / job.image.height;
      if (plan.homography) {
        if (steps.length === 0) {
          const copy = canvasFor(small.width, small.height);
          steps.push(copy);
          const held = contextOf(copy, job.colorSpace);
          if (!dead(held)) {
            held.drawImage(small.drawable, 0, 0);
            small = { ...small, drawable: copy };
          }
        }
        const cx = job.image.width / 2;
        const cy = job.image.height / 2;
        mesh(
          context,
          small.drawable,
          multiply(
            [a, c, e + a * cx + c * cy, b, d, f + b * cx + d * cy, 0, 0, 1],
            multiply(
              [...plan.homography],
              [1 / fx, 0, -cx, 0, 1 / fy, -cy, 0, 0, 1]
            )
          )
        );
        if (dead(context)) {
          throw fail("blank", "the browser lost the canvas");
        }
      } else {
        context.setTransform(a / fx, b / fx, c / fy, d / fy, e, f);
        context.drawImage(small.drawable, 0, 0);
        context.setTransform(1, 0, 0, 1, 0, 0);
      }
    } finally {
      for (const step of steps) {
        free(step);
      }
    }
    if (job.circle) {
      context.globalCompositeOperation = "destination-in";
      context.beginPath();
      context.ellipse(
        plan.width / 2,
        plan.height / 2,
        plan.width / 2,
        plan.height / 2,
        0,
        0,
        Math.PI * 2
      );
      context.fill();
    }
  };

  const encode = async (
    canvas: Canvas,
    type: string,
    quality: number
  ): Promise<Blob> => {
    if ("convertToBlob" in canvas) {
      return await canvas.convertToBlob({ quality, type });
    }
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(fail("blank", "the browser returned no image"));
          }
        },
        type,
        quality
      );
    });
  };

  const decodeFull = async (blob: Blob): Promise<ImageBitmap> => {
    try {
      return await createImageBitmap(blob);
    } catch {
      throw fail("undecodable", "the browser could not decode the file");
    }
  };

  return {
    async render(job) {
      const opened =
        job.source instanceof Blob ? await decodeFull(job.source) : job.source;
      const full: Drawable =
        opened instanceof ImageBitmap
          ? { drawable: opened, height: opened.height, width: opened.width }
          : opened;
      try {
        for (const [index, plan] of job.plans.entries()) {
          const canvas = canvasFor(plan.width, plan.height);
          try {
            paint(canvas, full, job, plan);
            return {
              blob: await encode(canvas, job.type, job.quality),
              index,
            };
          } catch (error) {
            if (
              index === job.plans.length - 1 ||
              (error instanceof Error && error.name === "SecurityError")
            ) {
              throw error;
            }
          } finally {
            free(canvas);
          }
          await new Promise((resolve) => {
            setTimeout(resolve, 0);
          });
        }
        throw fail("blank", "nothing to render");
      } finally {
        if (opened !== job.source && opened instanceof ImageBitmap) {
          opened.close();
        }
      }
    },
  };
};
