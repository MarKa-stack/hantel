// KI-Import: Das PDF geht an den Hantel-Server oder direkt an Claude/OpenAI (je nach Einstellung),
// zurück kommen die Übungen als strukturiertes JSON. Prompt/Schema in ai-tasks.js ('pdf-plans').
import { runTask } from './llm.js';

function toBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}

/**
 * @param {File} file PDF
 * @returns {Promise<{plans:Array}>}
 */
export async function aiExtractPlans(file) {
  if (file.size > 30 * 1024 * 1024) throw new Error('PDF ist größer als 30 MB.');
  const base64 = toBase64(await file.arrayBuffer());
  const { data } = await runTask('pdf-plans', { pdf: base64, name: file.name });
  return data;
}
