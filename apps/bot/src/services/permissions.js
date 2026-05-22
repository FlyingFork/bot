import { PermissionFlagsBits } from "discord.js";
import { ADMIN_ROLE_NAMES, GLOBAL_ADMIN_USER_ID } from "../constants/admin.js";
import { RESPONSE_LANGUAGE_PRIORITY } from "../constants/languages.js";
export function isAdmin(member) {
    if (member.id === GLOBAL_ADMIN_USER_ID) {
        return true;
    }
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
        return true;
    }
    return member.roles.cache.some((role) => ADMIN_ROLE_NAMES.has(role.name));
}
export function responseLanguageFor(member) {
    const roleNames = new Set(member.roles.cache.map((role) => role.name.toLowerCase()));
    for (const language of RESPONSE_LANGUAGE_PRIORITY) {
        if (roleNames.has(language) || roleNames.has(languageNameRole(language))) {
            return language;
        }
    }
    return "en";
}
function languageNameRole(language) {
    switch (language) {
        case "ru":
            return "russian";
        case "tr":
            return "turkish";
        case "en":
            return "english";
    }
}
