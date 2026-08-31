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
type CachedImageStatus = 'loading' | 'loaded' | 'error';

interface CachedImage {
    image: HTMLImageElement;
    lastUsedAt: number;
    listeners: Set<() => void>;
    status: CachedImageStatus;
}

/** Keep previews and long-lived boards from retaining stale image sources. */
const MAX_IMAGE_CACHE_ENTRIES = 100;
const IMAGE_CACHE_IDLE_MS = 60_000;
const imageCache = new Map<string, CachedImage>();

const touchImageCacheEntry = (key: string, entry: CachedImage) => {
    entry.lastUsedAt = Date.now();
    imageCache.delete(key);
    imageCache.set(key, entry);
};

const trimImageCache = () => {
    if (imageCache.size <= MAX_IMAGE_CACHE_ENTRIES) return;
    const idleBefore = Date.now() - IMAGE_CACHE_IDLE_MS;
    for (const [key, entry] of imageCache) {
        if (imageCache.size <= MAX_IMAGE_CACHE_ENTRIES) return;
        // A board can legitimately show more than the nominal cache limit.
        // Only discard idle sources so a large active board does not reload
        // its images on every repaint and enter an endless cache-thrash loop.
        if (entry.lastUsedAt > idleBefore) continue;
        entry.image.onload = null;
        entry.image.onerror = null;
        entry.listeners.clear();
        imageCache.delete(key);
    }
};

export function getCachedImage(
    dataUrl: string,
    _id: string,
    onSettled?: () => void,
): { image: HTMLImageElement; status: CachedImageStatus } {
    // The image source, rather than the element ID, is the cache identity.
    // Different boards may legitimately contain the same serialized element
    // ID with different image contents and must not evict each other forever.
    const cached = imageCache.get(dataUrl);
    if (cached) {
        if (onSettled && cached.status === 'loading') cached.listeners.add(onSettled);
        touchImageCacheEntry(dataUrl, cached);
        return { image: cached.image, status: cached.status };
    }

    const image = new Image();
    const entry: CachedImage = {
        image,
        lastUsedAt: Date.now(),
        listeners: new Set(onSettled ? [onSettled] : []),
        status: 'loading',
    };
    const settle = (status: Exclude<CachedImageStatus, 'loading'>) => {
        // Ignore a stale request that was replaced under the same element ID.
        if (imageCache.get(dataUrl) !== entry) return;
        entry.status = status;
        const listeners = [...entry.listeners];
        entry.listeners.clear();
        listeners.forEach((listener) => listener());
    };
    image.onload = () => settle('loaded');
    image.onerror = () => settle('error');
    imageCache.set(dataUrl, entry);
    trimImageCache();
    image.src = dataUrl;
    return { image, status: entry.status };
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
