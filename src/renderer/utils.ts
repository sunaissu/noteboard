// ─── Seeded PRNG for deterministic roughness ──────────────────
export function seededRandom(seed: number): () => number {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

// ─── Roughness helpers ────────────────────────────────────────
export function jitterPoint(x: number, y: number, roughness: number, rng: () => number) {
    const jitter = roughness * 1.5;
    return { x: x + (rng() - 0.5) * jitter, y: y + (rng() - 0.5) * jitter };
}

export function drawJitteredLine(
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number,
    x2: number, y2: number,
    roughness: number,
    rng: () => number,
) {
    if (roughness <= 0) { ctx.lineTo(x2, y2); return; }
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const segments = Math.max(2, Math.ceil(dist / 15));
    for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const px = x1 + (x2 - x1) * t;
        const py = y1 + (y2 - y1) * t;
        const jp = jitterPoint(px, py, roughness, rng);
        ctx.lineTo(jp.x, jp.y);
    }
}

// ─── Image cache ──────────────────────────────────────────────
const imageCache = new Map<string, HTMLImageElement>();

export function getCachedImage(dataUrl: string, id: string): HTMLImageElement | null {
    if (imageCache.has(id)) return imageCache.get(id)!;
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => { imageCache.set(id, img); };
    imageCache.set(id, img);
    return img;
}

// ─── Drop shadow helpers ──────────────────────────────────────
export function applyDropShadow(ctx: CanvasRenderingContext2D, shadow: { blur: number; offsetX: number; offsetY: number; color: string }) {
    ctx.shadowBlur = shadow.blur;
    ctx.shadowOffsetX = shadow.offsetX;
    ctx.shadowOffsetY = shadow.offsetY;
    ctx.shadowColor = shadow.color;
}

export function clearDropShadow(ctx: CanvasRenderingContext2D) {
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowColor = 'transparent';
}
