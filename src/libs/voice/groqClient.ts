/**
 * groqClient.ts
 *
 * Lightweight, token-cost optimized Groq Cloud LLM client for PG Saathi AI.
 *
 * Requirements (Layer B):
 * - Called strictly when Layer A (deterministic parser) cannot confidently classify.
 * - Uses configured model (default: qwen/qwen3.8-27b).
 * - Structured JSON output validated against central Capability Registry.
 * - Input string truncated (max 250 chars) and max_tokens capped to 120.
 * - Zero database mutations or fabrication; zero PII sent.
 * - In-memory metrics tracking (totalCalls, totalTokens, lastLatencyMs).
 * - Graceful fallback when key is missing, rate-limited, or times out.
 */

import { isValidIntent, SupportedIntentType } from "./capabilityRegistry";

export interface GroqIntentResult {
	intent: SupportedIntentType;
	roomNumber: string | null;
	sharingType?: "SINGLE" | "DOUBLE" | "TRIPLE" | "FOUR" | null;
	acType?: "AC" | "NON_AC" | null;
	attribute?: "RENT" | "AC" | "BEDS" | "SHARING" | "UNSUPPORTED" | null;
	confidence: number;
	needsClarification?: boolean;
	clarificationQuestion?: string;
}

export interface GroqMetrics {
	totalCalls: number;
	totalTokens: number;
	lastLatencyMs: number;
	lastError?: string;
}

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
export const DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b";
const TIMEOUT_MS = 6000;
const MAX_INPUT_CHARS = 250;

// In-memory metrics for token and cost observability
const groqMetrics: GroqMetrics = {
	totalCalls: 0,
	totalTokens: 0,
	lastLatencyMs: 0,
};

export function getGroqMetrics(): GroqMetrics {
	return { ...groqMetrics };
}

export function resetGroqMetrics(): void {
	groqMetrics.totalCalls = 0;
	groqMetrics.totalTokens = 0;
	groqMetrics.lastLatencyMs = 0;
	delete groqMetrics.lastError;
}

/**
 * Sanitizes input to prevent sending phone numbers, passwords, or PII to the LLM.
 */
function sanitizeInputForGroq(text: string): string {
	return (
		text
			// Mask 10-digit phone numbers
			.replace(/\b\d{10}\b/g, "[PHONE]")
			// Truncate to maximum input limit
			.slice(0, MAX_INPUT_CHARS)
			.trim()
	);
}

/**
 * Extracts structured intent from ambiguous user utterance via Groq fallback.
 */
export async function parseIntentWithGroq(
	userQuery: string,
	contextHint?: { lastRoom?: string }
): Promise<GroqIntentResult | null> {
	const apiKey = process.env.GROQ_API_KEY?.trim();
	if (!apiKey) {
		return null; // Safe fallback when no key is configured
	}

	const model = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
	const sanitizedQuery = sanitizeInputForGroq(userQuery);
	if (!sanitizedQuery) return null;

	const systemPrompt = `You are an intent parser for "Choose Bed", an Indian PG/Hostel management SaaS.
Classify the user's spoken or typed query (Hindi, Gujarati, Hinglish, English) into exactly one supported intent.

Allowed intents:
- "AVAILABLE_ROOMS": Which rooms are free/vacant
- "AVAILABLE_BEDS": How many total beds are free
- "TOTAL_ROOMS": Total count of rooms configured in PG
- "SPECIFIC_ROOM_BEDS": Status, vacancy, rent, or AC of a specific room number
- "AC_ROOM_AVAILABILITY": Check if any AC or Non-AC room is vacant
- "ROOM_SHARING_RENT": Rent rate for a specific sharing category (Single, Double, Triple, Four)
- "RESIDENT_CHECKINS_OR_COUNT": Today's check-ins or active residents count
- "BOOKING_OR_ADMISSION": Bed booking or resident onboarding request
- "CHECKOUT_OR_EXIT": Resident checkout or leaving request
- "ROOM_CREATION_GUIDANCE": How to add or create a new room or bed in PG
- "PAYMENT_COLLECTION_GUIDANCE": How to record rent collection
- "PAYMENT_HISTORY_OR_DUES": Dues, total payment collected, or personal rent status
- "AMENITIES_OR_DEPOSITS": Wi-Fi, Food, Deposit, Bathroom, Curfew queries
- "GREETING": Hello, Hi, Namaste, Kem cho
- "THANKS": Thank you, Shukriya, Dhanyawad
- "CAPABILITIES_OR_HELP": What can you do, Help
- "SIMPLIFIED_EXPLANATION": User asks for simple language / explanation
- "CLARIFICATION_NEEDED": Ambiguous room reference without room number
- "AMBIGUOUS_OR_UNSUPPORTED": Completely unrelated or unintelligible

Context hint: Last queried room was "${contextHint?.lastRoom || "none"}".

Respond strictly in JSON format:
{
  "intent": "<AllowedIntent>",
  "roomNumber": "101" | null,
  "sharingType": "SINGLE" | "DOUBLE" | "TRIPLE" | "FOUR" | null,
  "acType": "AC" | "NON_AC" | null,
  "attribute": "RENT" | "AC" | "BEDS" | "SHARING" | null,
  "confidence": 0.0 to 1.0,
  "needsClarification": false,
  "clarificationQuestion": null
}`;

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
	const startTime = Date.now();

	try {
		const response = await fetch(GROQ_API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: sanitizedQuery },
				],
				temperature: 0.1,
				max_tokens: 120,
				response_format: { type: "json_object" },
			}),
			signal: controller.signal,
		});

		clearTimeout(timeoutId);
		const latency = Date.now() - startTime;
		groqMetrics.totalCalls += 1;
		groqMetrics.lastLatencyMs = latency;

		if (!response.ok) {
			const errText = `HTTP ${response.status}`;
			groqMetrics.lastError = errText;
			console.warn(
				`[Groq API] ${errText}: Falling back to deterministic parser.`
			);
			return null;
		}

		const data = await response.json();
		if (data.usage?.total_tokens) {
			groqMetrics.totalTokens += Number(data.usage.total_tokens);
		}

		const rawContent = data.choices?.[0]?.message?.content?.trim();
		if (!rawContent) return null;

		let parsed: any;
		try {
			parsed = JSON.parse(rawContent);
		} catch {
			return null;
		}

		// Validate parsed intent against central capability registry
		if (parsed.intent && isValidIntent(parsed.intent)) {
			return {
				intent: parsed.intent as SupportedIntentType,
				roomNumber: parsed.roomNumber
					? String(parsed.roomNumber).toUpperCase()
					: null,
				sharingType: parsed.sharingType || null,
				acType: parsed.acType || null,
				attribute: parsed.attribute || null,
				confidence:
					typeof parsed.confidence === "number" ? parsed.confidence : 0.85,
				needsClarification: Boolean(parsed.needsClarification),
				clarificationQuestion: parsed.clarificationQuestion || undefined,
			};
		}

		return null;
	} catch (error: any) {
		clearTimeout(timeoutId);
		const latency = Date.now() - startTime;
		groqMetrics.lastLatencyMs = latency;
		groqMetrics.lastError = error?.message || String(error);

		if (error.name !== "AbortError") {
			console.warn("[Groq Client] Warning:", error.message || error);
		}
		return null;
	}
}

export interface GroqWhisperResult {
	success: boolean;
	transcript: string;
	language?: string;
}

/**
 * Transcribes audio buffer using Groq Whisper (whisper-large-v3-turbo).
 * Extremely fast (~150ms) and accepts WebM, WAV, MP3, M4A, OGG natively.
 */
export async function transcribeAudioWithGroqWhisper(
	audioBuffer: Buffer | Uint8Array,
	mimeType: string,
	languageCode?: string
): Promise<GroqWhisperResult | null> {
	const apiKey = process.env.GROQ_API_KEY?.trim();
	if (!apiKey) return null;

	let extension = "wav";
	if (mimeType.includes("webm")) extension = "webm";
	else if (mimeType.includes("ogg")) extension = "ogg";
	else if (mimeType.includes("mp4") || mimeType.includes("m4a"))
		extension = "m4a";
	else if (mimeType.includes("mpeg") || mimeType.includes("mp3"))
		extension = "mp3";

	const formData = new FormData();
	const blob = new Blob([audioBuffer as unknown as BlobPart], {
		type: mimeType,
	});
	formData.append("file", blob, `audio.${extension}`);
	formData.append("model", "whisper-large-v3-turbo");
	formData.append("response_format", "verbose_json");
	formData.append("temperature", "0.0");
	formData.append(
		"prompt",
		"ChooseBed PG and Hostel operations: available rooms, beds, vacancies, AC, Non-AC, sharing, monthly rent, tenant dues, resident admission, kaunse, kitne, khali, baki."
	);

	// Only specify fixed language if explicitly requested (not "auto")
	if (languageCode && languageCode !== "auto") {
		const lang = languageCode.split("-")[0]?.toLowerCase();
		if (lang && ["hi", "gu", "en", "mr", "ta", "te", "bn"].includes(lang)) {
			formData.append("language", lang);
		}
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 12000);

	try {
		const response = await fetch(
			"https://api.groq.com/openai/v1/audio/transcriptions",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
				},
				body: formData,
				signal: controller.signal,
			}
		);

		clearTimeout(timeoutId);

		if (!response.ok) {
			const errText = await response.text().catch(() => "");
			console.warn(`[Groq Whisper] HTTP ${response.status}:`, errText);
			return null;
		}

		const data = await response.json();
		const transcript = (data.text || "").trim();

		// Normalize detected language from Whisper verbose_json
		let detectedLang = "hi";
		const rawLang = (data.language || "").toLowerCase();
		if (rawLang.includes("english") || rawLang === "en") detectedLang = "en";
		else if (rawLang.includes("gujarati") || rawLang === "gu")
			detectedLang = "gu";
		else if (rawLang.includes("hindi") || rawLang === "hi") detectedLang = "hi";

		return {
			success: Boolean(transcript),
			transcript,
			language: detectedLang,
		};
	} catch (err: any) {
		clearTimeout(timeoutId);
		console.warn("[Groq Whisper] Transcribe error:", err?.message || err);
		return null;
	}
}
