const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE_ICON = path.join(__dirname, '../public/img/favicon-512x512.png');
const BACKGROUND = { r: 255, g: 255, b: 255, alpha: 1 };

/** Android adaptive icon safe zone: keep artwork inside ~66% center area */
const PADDING_BY_PURPOSE = {
    any: 0.1,
    maskable: 0.17
};

const cache = new Map();

async function getSourceMtime() {
    const stat = await fs.promises.stat(SOURCE_ICON);
    return stat.mtimeMs;
}

/**
 * @param {192|512} size
 * @param {'any'|'maskable'} purpose
 */
async function generateIcon(size, purpose) {
    const paddingRatio = PADDING_BY_PURPOSE[purpose] ?? PADDING_BY_PURPOSE.maskable;
    const cacheKey = `${size}:${purpose}`;
    const mtime = await getSourceMtime();
    const cached = cache.get(cacheKey);
    if (cached && cached.mtime === mtime) {
        return cached.buffer;
    }

    const innerSize = Math.max(1, Math.round(size * (1 - paddingRatio * 2)));
    const pad = Math.floor((size - innerSize) / 2);
    const padBottom = size - innerSize - pad;
    const padRight = padBottom;

    const buffer = await sharp(SOURCE_ICON)
        .resize(innerSize, innerSize, {
            fit: 'contain',
            background: BACKGROUND
        })
        .extend({
            top: pad,
            bottom: padBottom,
            left: pad,
            right: padRight,
            background: BACKGROUND
        })
        .png({ compressionLevel: 9 })
        .toBuffer();

    cache.set(cacheKey, { buffer, mtime });
    return buffer;
}

module.exports = {
    generateIcon,
    VALID_SIZES: [192, 512],
    VALID_PURPOSES: ['any', 'maskable']
};
