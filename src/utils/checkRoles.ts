import { ChatInputCommandInteraction, GuildMember } from 'discord.js';

export function checkRoles(
  interaction: ChatInputCommandInteraction,
  requiredRoles: string[],
): boolean {
  if (requiredRoles.length === 0) return true;
  if (!interaction.inGuild()) return false;
  const member = interaction.member as GuildMember;
  return member.roles.cache.some((role) => requiredRoles.includes(role.name));
}
