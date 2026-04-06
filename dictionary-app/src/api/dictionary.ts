const BASE = "https://api.dictionaryapi.dev/api/v2/entries/en";

export type DictionaryMeaning = {
  partOfSpeech: string;
  definitions: Array<{
    definition: string;
    example?: string;
    synonyms?: string[];
    antonyms?: string[];
  }>;
};

export type DictionaryEntry = {
  word: string;
  phonetic?: string;
  phonetics: Array<{ text?: string; audio?: string }>;
  meanings: DictionaryMeaning[];
};

export async function fetchWord(word: string): Promise<DictionaryEntry[]> {
  const q = encodeURIComponent(word.trim().toLowerCase());
  const res = await fetch(`${BASE}/${q}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Dictionary request failed (${res.status})`);
  return (await res.json()) as DictionaryEntry[];
}
