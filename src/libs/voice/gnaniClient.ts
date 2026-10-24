/**
 * gnaniClient.ts
 *
 * Server-side client for Gnani.ai Voice Services (Prisma v2.5 STT).
 * Official Endpoint: POST https://api.vachana.ai/stt/v3
 *
 * Security:
 * - Executes on the server only.
 * - Credentials never leak to browser clients.
 * - Handles timeouts, size limits, and provider error codes gracefully.
 */

export interface GnaniTranscribeOptions {
	languageCode?: string; // e.g. "hi-IN", "gu-IN", "en-IN"
	preferredLanguage?: string;
	format?: "transcribe" | "verbatim";
	itnNativeNumerals?: boolean;
}

export interface GnaniTranscribeResult {
	success: boolean;
	transcript: string;
	language: string;
	requestId?: string;
	rawResponse?: any;
}

const DEFAULT_BASE_URL = "https://api.vachana.ai";
const REQUEST_TIMEOUT_MS = 15000; // 15 seconds

/**
 * Transcribes an audio buffer using Gnani Prisma v2.5 REST API.
 */
export async function transcribeAudioWithGnani(
	audioBuffer: Buffer | Uint8Array,
	mimeType: string,
	options: GnaniTranscribeOptions = {}
): Promise<GnaniTranscribeResult> {
	const apiKey = process.env.GNANI_API_KEY?.trim();
	const baseUrl = process.env.GNANI_BASE_URL?.trim() || DEFAULT_BASE_URL;

	if (!apiKey) {
		throw new Error(
			"GNANI_CONFIG_ERROR: GNANI_API_KEY is not configured in server environment variables. Please provide your Gnani API key."
		);
	}

	const languageCode = options.languageCode || "hi-IN";
	const preferredLanguage = options.preferredLanguage || languageCode;
	const format = options.format || "transcribe";
	const itnNativeNumerals = options.itnNativeNumerals ? "true" : "false";

	// Determine file extension from mimeType or RIFF magic bytes
	let extension = "wav";
	const isRiffWav =
		audioBuffer.length >= 4 &&
		audioBuffer[0] === 0x52 &&
		audioBuffer[1] === 0x49 &&
		audioBuffer[2] === 0x46 &&
		audioBuffer[3] === 0x46;

	if (isRiffWav || mimeType.includes("wav")) extension = "wav";
	else if (mimeType.includes("webm")) extension = "webm";
	else if (mimeType.includes("ogg")) extension = "ogg";
	else if (mimeType.includes("mp4") || mimeType.includes("m4a"))
		extension = "m4a";
	else if (mimeType.includes("mpeg") || mimeType.includes("mp3"))
		extension = "mp3";

	// Construct multipart/form-data payload
	const formData = new FormData();
	const audioBlob = new Blob([audioBuffer as unknown as BlobPart], {
		type: mimeType,
	});
	formData.append("audio_file", audioBlob, `recording.${extension}`);
	formData.append("language_code", languageCode);
	formData.append("preferred_language", preferredLanguage);
	formData.append("format", format);
	formData.append("itn_native_numerals", itnNativeNumerals);

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		const response = await fetch(`${baseUrl}/stt/v3`, {
			method: "POST",
			headers: {
				"X-API-Key-ID": apiKey,
			},
			body: formData,
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			const errorText = await response.text().catch(() => "");
			let errorMessage = `Gnani STT API returned HTTP ${response.status}`;
			try {
				const jsonErr = JSON.parse(errorText);
				if (jsonErr.error?.message) {
					errorMessage = jsonErr.error.message;
				} else if (typeof jsonErr.error === "string") {
					errorMessage = jsonErr.error;
				} else if (typeof jsonErr.message === "string") {
					errorMessage = jsonErr.message;
				} else if (Array.isArray(jsonErr.detail)) {
					errorMessage = jsonErr.detail
						.map((d: any) => d.msg || JSON.stringify(d))
						.join(", ");
				} else if (jsonErr.detail) {
					errorMessage =
						typeof jsonErr.detail === "string"
							? jsonErr.detail
							: JSON.stringify(jsonErr.detail);
				}
			} catch {
				if (errorText) errorMessage += `: ${errorText.slice(0, 150)}`;
			}

			if (response.status === 401 || response.status === 403) {
				throw new Error(
					`GNANI_AUTH_ERROR: Invalid or expired Gnani API credentials (${errorMessage}).`
				);
			}

			if (response.status === 429) {
				throw new Error(
					`GNANI_RATE_LIMIT: Gnani API credit quota or rate limit exceeded.`
				);
			}

			throw new Error(`GNANI_API_ERROR: ${errorMessage}`);
		}

		const data = await response.json();

		// Normalize Gnani STT transcript response
		const transcript = (
			data.transcript ||
			data.text ||
			data.data?.transcript ||
			""
		).trim();

		return {
			success: true,
			transcript,
			language: languageCode,
			requestId: data.request_id || data.id,
			rawResponse: process.env.NODE_ENV === "development" ? data : undefined,
		};
	} catch (error: any) {
		clearTimeout(timeoutId);
		if (error.name === "AbortError") {
			throw new Error(
				"GNANI_TIMEOUT: Speech-to-text request timed out after 15 seconds."
			);
		}
		throw error;
	}
}

export interface GnaniSynthesizeOptions {
	voice?: string; // e.g. "Nalini"
	language?: string; // e.g. "hi-IN", "gu-IN", "en-IN"
	speed?: number; // 0.8 - 1.2
	sampleRate?: number; // 16000, 24000, 48000
}

// ES5 compatible emoji and formatting stripper regex
const EMOJI_AND_SYMBOLS_REGEX =
	/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]|[\uFE00-\uFE0F]|[\u200D]/g;

/**
 * Strips UI symbols, emojis, and formatting markers before TTS synthesis
 * to ensure natural speech output and prevent quota waste on special characters.
 */
export function sanitizeTextForTTS(rawText: string): string {
	if (!rawText) return "";

	return (
		rawText
			// Remove emojis (surrogate pairs, pictographs, symbols, flags, variation selectors)
			.replace(EMOJI_AND_SYMBOLS_REGEX, "")
			// Remove markdown links and brackets
			.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
			.replace(/[*_#`~]/g, "")
			// Clean up multiple spaces, commas and dots
			.replace(/\s+/g, " ")
			.replace(/,\s*,/g, ",")
			.trim()
	);
}

/**
 * Generates spoken audio from text using Gnani Timbre TTS REST API.
 * Credit Safeguards:
 * - Truncates text to max 300 characters to prevent high credit consumption.
 * - 10-second timeout.
 * - Returns raw audio WAV buffer.
 */
export async function synthesizeSpeechWithGnani(
	text: string,
	options: GnaniSynthesizeOptions = {}
): Promise<Buffer> {
	const apiKey = process.env.GNANI_API_KEY?.trim();
	const baseUrl = process.env.GNANI_BASE_URL?.trim() || DEFAULT_BASE_URL;

	if (!apiKey) {
		throw new Error(
			"GNANI_CONFIG_ERROR: GNANI_API_KEY is not configured in server environment variables."
		);
	}

	const cleanText = sanitizeTextForTTS(text);
	if (!cleanText) {
		throw new Error("Cannot synthesize speech from empty text.");
	}

	// Hard limit of 300 characters to strictly protect the 5,000 credit challenge pool
	const limitedText = cleanText.slice(0, 300);

	const language = options.language || "hi-IN";
	const voice = options.voice || "Shivani";
	const speed = options.speed || 1.0;
	const sampleRate = options.sampleRate || 24000;

	const payload = {
		text: limitedText,
		voice,
		model: "timbre-v3.0",
		language,
		speed,
		audio_config: {
			encoding: "linear_pcm",
			container: "wav",
			num_channels: 1,
			sample_rate: sampleRate,
			sample_width: 2,
		},
	};

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

	try {
		const response = await fetch(`${baseUrl}/api/v1/tts/inference`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-API-Key-ID": apiKey,
			},
			body: JSON.stringify(payload),
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			const errorText = await response.text().catch(() => "");
			let errorMessage = `Gnani TTS returned HTTP ${response.status}`;
			try {
				const jsonErr = JSON.parse(errorText);
				if (jsonErr.error?.message) {
					errorMessage = jsonErr.error.message;
				} else if (typeof jsonErr.error === "string") {
					errorMessage = jsonErr.error;
				} else if (typeof jsonErr.message === "string") {
					errorMessage = jsonErr.message;
				} else if (Array.isArray(jsonErr.detail)) {
					errorMessage = jsonErr.detail
						.map((d: any) => d.msg || JSON.stringify(d))
						.join(", ");
				} else if (jsonErr.detail) {
					errorMessage =
						typeof jsonErr.detail === "string"
							? jsonErr.detail
							: JSON.stringify(jsonErr.detail);
				}
			} catch {
				if (errorText) errorMessage += `: ${errorText.slice(0, 100)}`;
			}

			if (response.status === 401 || response.status === 403) {
				throw new Error(
					`GNANI_AUTH_ERROR: Invalid Gnani credentials (${errorMessage}).`
				);
			}
			if (response.status === 429) {
				throw new Error(
					"GNANI_RATE_LIMIT: Gnani TTS credit quota or rate limit exceeded."
				);
			}

			throw new Error(`GNANI_API_ERROR: ${errorMessage}`);
		}

		const arrayBuffer = await response.arrayBuffer();
		return Buffer.from(arrayBuffer);
	} catch (error: any) {
		clearTimeout(timeoutId);
		if (error.name === "AbortError") {
			throw new Error(
				"GNANI_TIMEOUT: TTS audio synthesis timed out after 10 seconds."
			);
		}
		throw error;
	}
}
