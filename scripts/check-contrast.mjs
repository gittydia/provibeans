import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const files = ["app/globals.css", "app/app.css", "app/notifications.css"];
const sources = files.map((file) => ({ file, css: readFileSync(resolve(file), "utf8") }));

function blocksFor(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}\\s*\\{`, "g");
  const blocks = [];
  let match;

  while ((match = pattern.exec(css))) {
    const open = css.indexOf("{", match.index);
    let depth = 1;
    let cursor = open + 1;
    while (cursor < css.length && depth > 0) {
      if (css[cursor] === "{") depth += 1;
      if (css[cursor] === "}") depth -= 1;
      cursor += 1;
    }
    if (depth !== 0) throw new Error(`Unclosed ${selector} block`);
    blocks.push(css.slice(open + 1, cursor - 1));
    pattern.lastIndex = cursor;
  }

  return blocks;
}

function propertiesFrom(blocks) {
  const properties = new Map();
  for (const block of blocks) {
    for (const match of block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
      properties.set(`--${match[1]}`, match[2].trim());
    }
  }
  return properties;
}

const light = propertiesFrom(sources.flatMap(({ css }) => blocksFor(css, ":root")));
const darkData = new Map(light);
const darkMedia = new Map(light);

for (const { css } of sources) {
  for (const [name, value] of propertiesFrom(blocksFor(css, ':root[data-theme="dark"]'))) {
    darkData.set(name, value);
  }
  for (const [name, value] of propertiesFrom(blocksFor(css, ':root:not([data-theme="light"])'))) {
    darkMedia.set(name, value);
  }
}

function parseColor(value) {
  const hex = value.match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex) {
    const expanded = hex.length <= 4 ? [...hex].map((part) => part + part).join("") : hex;
    const channels = expanded.match(/.{2}/g).map((part) => Number.parseInt(part, 16) / 255);
    return { rgb: channels.slice(0, 3), alpha: channels[3] ?? 1 };
  }

  const rgb = value.match(/^rgba?\((.+)\)$/i)?.[1];
  if (rgb) {
    const [channelText, alphaText] = rgb.split("/").map((part) => part.trim());
    const channels = channelText.includes(",")
      ? channelText.split(",").map((part) => part.trim())
      : channelText.split(/\s+/);
    if (channels.length !== 3) throw new Error(`Unsupported color: ${value}`);
    return {
      rgb: channels.map((part) =>
        part.endsWith("%") ? Number.parseFloat(part) / 100 : Number.parseFloat(part) / 255,
      ),
      alpha: alphaText === undefined
        ? 1
        : alphaText.endsWith("%")
          ? Number.parseFloat(alphaText) / 100
          : Number.parseFloat(alphaText),
    };
  }

  throw new Error(`Unsupported color: ${value}`);
}

function composite(foreground, background) {
  return foreground.rgb.map(
    (channel, index) => channel * foreground.alpha + background.rgb[index] * (1 - foreground.alpha),
  );
}

function luminance(rgb) {
  const linear = rgb.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foregroundValue, backgroundValue) {
  const background = parseColor(backgroundValue);
  const foreground = parseColor(foregroundValue);
  const backgroundRgb = composite(background, { rgb: [1, 1, 1], alpha: 1 });
  const foregroundRgb = composite(foreground, { rgb: backgroundRgb, alpha: 1 });
  const foregroundLuminance = luminance(foregroundRgb);
  const backgroundLuminance = luminance(backgroundRgb);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

const pairs = [];
for (const foreground of ["--app-ink", "--app-ink-soft", "--app-ink-faint"]) {
  for (const background of ["--app-bg", "--app-surface", "--app-sunk"]) {
    pairs.push({ foreground, background, minimum: 4.5 });
  }
}
pairs.push(
  { foreground: "--app-placeholder", background: "--app-input-bg", minimum: 4.5 },
  { foreground: "--app-input-line", background: "--app-input-bg", minimum: 3 },
  ...["--app-ok", "--app-warn", "--app-crit", "--app-info"].map((foreground) => ({
    foreground,
    background: "--app-surface",
    minimum: 4.5,
  })),
  ...["--app-ok", "--app-warn", "--app-crit", "--app-info"].map((background) => ({
    foreground: "--app-status-text",
    background,
    minimum: 4.5,
  })),
);

const themes = [
  { name: "light", properties: light },
  { name: "dark (data-theme)", properties: darkData },
  { name: "dark (system preference)", properties: darkMedia },
];
const results = [];

for (const theme of themes) {
  for (const pair of pairs) {
    const foregroundValue = theme.properties.get(pair.foreground);
    const backgroundValue = theme.properties.get(pair.background);
    if (!foregroundValue || !backgroundValue) {
      results.push({ ...pair, theme: theme.name, ratio: Number.NaN, detail: "missing token" });
      continue;
    }
    try {
      results.push({
        ...pair,
        theme: theme.name,
        ratio: contrast(foregroundValue, backgroundValue),
        detail: `${foregroundValue} on ${backgroundValue}`,
      });
    } catch (error) {
      results.push({
        ...pair,
        theme: theme.name,
        ratio: Number.NaN,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

const failed = results.filter((result) => !Number.isFinite(result.ratio) || result.ratio < result.minimum);
if (failed.length > 0) {
  console.error("Contrast checks failed:");
  console.error("Theme | Pair | Ratio | Required | Values");
  for (const result of failed) {
    console.error(
      `${result.theme} | ${result.foreground} / ${result.background} | ${Number.isFinite(result.ratio) ? `${result.ratio.toFixed(2)}:1` : "n/a"} | ${result.minimum.toFixed(1)}:1 | ${result.detail}`,
    );
  }
  process.exitCode = 1;
} else {
  console.log(`PASS: ${results.length}/${results.length} contrast checks passed across light and both dark-theme token blocks.`);
  for (const theme of themes) {
    const themeResults = results.filter((result) => result.theme === theme.name);
    const lowest = themeResults.reduce((current, result) =>
      result.ratio / result.minimum < current.ratio / current.minimum ? result : current,
    );
    console.log(
      `  ${theme.name}: lowest margin ${lowest.foreground} / ${lowest.background} = ${lowest.ratio.toFixed(2)}:1 (minimum ${lowest.minimum.toFixed(1)}:1)`,
    );
  }
}
