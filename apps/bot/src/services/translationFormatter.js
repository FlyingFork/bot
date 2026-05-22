const PROTECTED_PATTERN = /(```[\s\S]*?(?:```|$)|`[^`\n]+`|https?:\/\/[^\s<>()]+|<a?:\w+:\d+>|\*\*\*|\*\*|__|~~|\|\||(?<!\*)\*(?!\*)|(?:[\u{1F1E6}-\u{1F1FF}]{2})|(?:\p{Extended_Pictographic}(?:\uFE0F|\uFE0E|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E|\p{Emoji_Modifier})?)*)|[\u{1F300}-\u{1FAFF}])/gu;
export function tokenizeProtectedText(text) {
    const tokens = [];
    const protectedText = text.replace(PROTECTED_PATTERN, (value) => {
        const key = `__BOT_TOKEN_${tokens.length}__`;
        tokens.push({ key, value });
        return key;
    });
    return { text: protectedText, tokens };
}
export function restoreProtectedText(text, tokens) {
    return tokens.reduce((result, token) => result.replaceAll(token.key, token.value), text);
}
export function segmentProtectedText(text) {
    const segments = [];
    let cursor = 0;
    for (const match of text.matchAll(PROTECTED_PATTERN)) {
        const index = match.index ?? 0;
        if (index > cursor) {
            segments.push({ kind: "text", value: text.slice(cursor, index) });
        }
        segments.push({ kind: "protected", value: match[0] });
        cursor = index + match[0].length;
    }
    if (cursor < text.length) {
        segments.push({ kind: "text", value: text.slice(cursor) });
    }
    return mergeAdjacentTextSegments(segments);
}
function mergeAdjacentTextSegments(segments) {
    const merged = [];
    for (const segment of segments) {
        const previous = merged.at(-1);
        if (previous?.kind === "text" && segment.kind === "text") {
            previous.value += segment.value;
        }
        else {
            merged.push({ ...segment });
        }
    }
    return merged;
}
export function splitDiscordMessages(text, limit = 2000) {
    if (text.length <= limit) {
        return [text];
    }
    const chunks = [];
    let remaining = text;
    while (remaining.length > limit) {
        const slice = remaining.slice(0, limit);
        const splitAt = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf(" "));
        const index = splitAt > 200 ? splitAt : limit;
        chunks.push(remaining.slice(0, index));
        remaining = remaining.slice(index).trimStart();
    }
    if (remaining.length > 0) {
        chunks.push(remaining);
    }
    return chunks;
}
export function messageTextWithStickers(content, stickers) {
    const stickerText = [...stickers].map((sticker) => `[sticker: ${sticker.name}]`).join("\n");
    return [content, stickerText].filter(Boolean).join(content && stickerText ? "\n" : "");
}
