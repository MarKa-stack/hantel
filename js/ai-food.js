// KI-Freitext: „500 g Hähnchenbrust, 200 g Philadelphia, 1 Apfel“ → Zutaten mit Gramm und Nährwerten pro 100 g.
// Prompt/Schema in ai-tasks.js ('food-text'); läuft über den Hantel-Server oder den eigenen Key (llm.js).
import { runTask } from './llm.js';

/**
 * @param {string} text Freitext
 * @returns {Promise<{items:Array, servings:number|null, title:string|null}>}
 */
export async function aiParseFood(text) {
  const { data } = await runTask('food-text', { text });
  return data;
}
