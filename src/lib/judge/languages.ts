import type { Language } from "@/lib/data/schema";

export interface LanguageConfig {
  id: number; // Judge0 CE language id
  label: string;
  ext: string;
  mainFile?: string;
  monaco: string;
  version: string;
  enabled: boolean;
  /** CPU-time multiplier vs. the problem limit (JVM start-up is slow). */
  cpuFactor: number;
}

/** Judge0 CE ids — verified against GET /languages at startup (see `verifyLanguages`). D-01: all four enabled. */
export const LANGUAGES: Record<Language, LanguageConfig> = {
  java: { id: 62, label: "Java", ext: "java", mainFile: "Main.java", monaco: "java", version: "OpenJDK 13", enabled: true, cpuFactor: 2 },
  python: { id: 71, label: "Python3", ext: "py", monaco: "python", version: "3.8", enabled: true, cpuFactor: 1 },
  cpp: { id: 54, label: "C++", ext: "cpp", monaco: "cpp", version: "GCC 9", enabled: true, cpuFactor: 1 },
  javascript: { id: 63, label: "JavaScript", ext: "js", monaco: "javascript", version: "Node 12", enabled: true, cpuFactor: 1 },
};

export const LANGUAGE_KEYS = Object.keys(LANGUAGES) as Language[];
export const ENABLED_LANGUAGES = LANGUAGE_KEYS.filter((k) => LANGUAGES[k].enabled);

export function isLanguage(x: string): x is Language {
  return x in LANGUAGES;
}
