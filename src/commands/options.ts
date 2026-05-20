import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from "../constants/languages.js";

export const languageChoices = SUPPORTED_LANGUAGES.map((language) => ({
  name: LANGUAGE_LABELS[language],
  value: language
}));
