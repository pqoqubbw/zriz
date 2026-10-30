export interface KernelPlan {
  width: number;
  height: number;
  forward: readonly number[];
  homography: readonly number[] | null;
}

export interface DecodeReply {
  width: number;
  height: number;
  preview: ImageBitmap;
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

export interface Kernel {
  decode: (blob: Blob, edge: number) => Promise<DecodeReply>;
  render: (job: RenderJob) => Promise<RenderReply>;
}

export const imageKernel = (): Kernel => {
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
    canvas: Canvas,
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
    const steps = 24;
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
      const mx = (p[0] + q[0] + r[0]) / 3;
      const my = (p[1] + q[1] + r[1]) / 3;
      const out = ([x, y]: [number, number]): [number, number] => {
        const length = Math.hypot(x - mx, y - my) || 1;
        return [x + ((x - mx) / length) * 0.5, y + ((y - my) / length) * 0.5];
      };
      context.save();
      context.beginPath();
      context.moveTo(...out(p));
      context.lineTo(...out(q));
      context.lineTo(...out(r));
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
    for (let i = 0; i < steps; i += 1) {
      for (let j = 0; j < steps; j += 1) {
        const x0 = (i / steps) * width;
        const x1 = ((i + 1) / steps) * width;
        const y0 = (j / steps) * height;
        const y1 = ((j + 1) / steps) * height;
        triangle([x0, y0], [x1, y0], [x1, y1]);
        triangle([x0, y0], [x1, y1], [x0, y1]);
      }
    }
  };

  const dead = (context: Context): boolean => {
    const { width, height } = context.canvas;
    const corners: [number, number][] = [
      [0, 0],
      [width - 1, height - 1],
    ];
    return corners.some(([x, y]) => {
      context.fillStyle = "#010203";
      context.fillRect(x, y, 1, 1);
      const { data } = context.getImageData(x, y, 1, 1);
      context.clearRect(x, y, 1, 1);
      return data[3] === 0;
    });
  };

  const paint = (
    full: Drawable,
    job: RenderJob,
    plan: KernelPlan
  ): { canvas: Canvas; empty: boolean } => {
    const canvas = canvasFor(plan.width, plan.height);
    const context = contextOf(canvas, job.colorSpace);
    const empty = dead(context);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    if (job.circle) {
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
      context.clip();
    }
    const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = plan.forward;
    const fx = full.width / job.image.width;
    const fy = full.height / job.image.height;
    if (plan.homography) {
      const cx = job.image.width / 2;
      const cy = job.image.height / 2;
      mesh(
        context,
        full.drawable,
        multiply(
          [a, c, e + a * cx + c * cy, b, d, f + b * cx + d * cy, 0, 0, 1],
          multiply(
            [...plan.homography],
            [1 / fx, 0, -cx, 0, 1 / fy, -cy, 0, 0, 1]
          )
        )
      );
    } else {
      context.setTransform(a / fx, b / fx, c / fy, d / fy, e, f);
      context.drawImage(full.drawable, 0, 0);
      context.setTransform(1, 0, 0, 1, 0, 0);
    }
    return { canvas, empty };
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
      throw fail("decode", "this browser cannot decode the file");
    }
  };

  return {
    async decode(blob, edge) {
      const full = await decodeFull(blob);
      const scale = Math.min(1, edge / Math.max(full.width, full.height));
      const { width, height } = full;
      if (scale === 1) {
        return { height, preview: full, width };
      }
      const preview = await createImageBitmap(full, {
        resizeHeight: Math.max(1, Math.round(height * scale)),
        resizeQuality: "medium",
        resizeWidth: Math.max(1, Math.round(width * scale)),
      });
      full.close();
      return { height, preview, width };
    },
    async render(job) {
      const owned =
        job.source instanceof Blob ? await decodeFull(job.source) : null;
      let full: Drawable;
      if (owned) {
        full = { drawable: owned, height: owned.height, width: owned.width };
      } else if (job.source instanceof Blob) {
        throw fail("decode", "no bitmap");
      } else if (job.source instanceof ImageBitmap) {
        full = {
          drawable: job.source,
          height: job.source.height,
          width: job.source.width,
        };
      } else {
        full = job.source;
      }
      try {
        for (const [index, plan] of job.plans.entries()) {
          const { canvas, empty } = paint(full, job, plan);
          if (!empty || index === job.plans.length - 1) {
            try {
              if (empty) {
                throw fail("blank", "the browser drew a blank canvas");
              }
              return {
                blob: await encode(canvas, job.type, job.quality),
                index,
              };
            } finally {
              free(canvas);
            }
          }
          free(canvas);
        }
        throw fail("blank", "nothing to render");
      } finally {
        owned?.close();
      }
    },
  };
};
