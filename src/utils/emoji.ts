import type { Guild } from "discord.js";

const CUSTOM_EMOJI_REGEX = /<(a?):([a-zA-Z0-9_]+):(\d+)>/g;

function emojiCdnUrl(id: string, animated: boolean): string {
  return `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}?v=1`;
}

/**
 * Replace custom emoji tokens with either the original token (if the target
 * guild has the emoji) or a markdown link to the emoji CDN so recipients
 * still see the image when the emoji isn't available in their guild.
 */
export async function transformCustomEmojiForGuild(
  guild: Guild,
  text: string,
): Promise<string> {
  if (!text) return text;

  return text.replace(CUSTOM_EMOJI_REGEX, (_full, animatedFlag, name, id) => {
    const animated = animatedFlag === "a";
    try {
      if (guild && guild.emojis && guild.emojis.cache.has(id)) {
        // Emoji exists in this guild — preserve original token so it renders.
        return `<${animated ? "a:" : ""}${name}:${id}>`;
      }
    } catch (_) {
      // Fall through to returning CDN link on any error.
    }

    const url = emojiCdnUrl(id, animated);
    return `[${name}](${url})`;
  });
}

export function findCustomEmojis(text: string) {
  const matches: Array<{
    full: string;
    name: string;
    id: string;
    animated: boolean;
  }> = [];
  if (!text) return matches;
  let m: RegExpExecArray | null;
  const fresh = new RegExp(CUSTOM_EMOJI_REGEX.source, CUSTOM_EMOJI_REGEX.flags);
  while ((m = fresh.exec(text)) !== null) {
    matches.push({ full: m[0], name: m[2], id: m[3], animated: m[1] === "a" });
  }
  return matches;
}
