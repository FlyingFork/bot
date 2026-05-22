import { prisma } from "../db.js";
import { languageFromEmoji } from "../constants/languages.js";
import { logToAdmin } from "../services/adminLog.js";
import { logger } from "../logger.js";
export function registerReactionEvents(client) {
    client.on("messageReactionAdd", async (reaction, user) => {
        await handleReactionAdd(reaction, user).catch((error) => logger.error({ error }, "reaction add failed"));
    });
    client.on("messageReactionRemove", async (reaction, user) => {
        await handleReactionRemove(reaction, user).catch((error) => logger.error({ error }, "reaction remove failed"));
    });
}
async function handleReactionAdd(reaction, user) {
    if (user.bot)
        return;
    const fullReaction = reaction.partial ? await reaction.fetch() : reaction;
    const message = fullReaction.message.partial ? await fullReaction.message.fetch() : fullReaction.message;
    const guild = message.guild;
    if (!guild)
        return;
    const record = await prisma.reactionRoleMessage.findUnique({
        where: { messageId: message.id },
        include: { roles: true }
    });
    if (!record)
        return;
    const emoji = fullReaction.emoji.toString();
    const language = languageFromEmoji(emoji);
    if (!language || !record.languages.includes(language)) {
        await fullReaction.users.remove(user.id).catch(() => undefined);
        return;
    }
    if (record.status !== "READY") {
        return;
    }
    const assignment = record.roles.find((role) => role.language === language);
    if (!assignment)
        return;
    const member = await guild.members.fetch(user.id).catch(() => null);
    await member?.roles.add(assignment.roleId, "Language reaction role").catch(async (error) => {
        await logToAdmin(guild, `Failed assigning role <@&${assignment.roleId}>: ${error instanceof Error ? error.message : String(error)}`);
    });
    await prisma.roleAssignmentAudit.create({
        data: { guildId: guild.id, userId: user.id, roleId: assignment.roleId, language, assigned: true }
    });
}
async function handleReactionRemove(reaction, user) {
    if (user.bot)
        return;
    const fullReaction = reaction.partial ? await reaction.fetch() : reaction;
    const message = fullReaction.message.partial ? await fullReaction.message.fetch() : fullReaction.message;
    const guild = message.guild;
    if (!guild)
        return;
    const language = languageFromEmoji(fullReaction.emoji.toString());
    if (!language)
        return;
    const assignment = await prisma.reactionRoleAssignment.findUnique({
        where: { messageId_language: { messageId: message.id, language } }
    });
    if (!assignment)
        return;
    const member = await guild.members.fetch(user.id).catch(() => null);
    await member?.roles.remove(assignment.roleId, "Language reaction removed").catch(async (error) => {
        await logToAdmin(guild, `Failed removing role <@&${assignment.roleId}>: ${error instanceof Error ? error.message : String(error)}`);
    });
    await prisma.roleAssignmentAudit.create({
        data: { guildId: guild.id, userId: user.id, roleId: assignment.roleId, language, assigned: false }
    });
}
