/**
 * roomBedQueryService.ts
 *
 * Deterministic Query & Hybrid Conversation Service for PG Saathi AI.
 *
 * Architecture:
 * - Layer A: Deterministic Indic/English parsing (Zero LLM token cost)
 * - Layer B: Optional Groq fallback (Only when ambiguous / confidence < 0.75)
 * - Layer C: Authorized, database-grounded response execution
 *
 * Rules:
 * - Multi-tenant isolation: Strictly scoped to authenticated owner's properties.
 * - Availability truth: Derived strictly from Bed.status === "AVAILABLE".
 * - MAINTENANCE beds are never reported as available.
 * - Room cards only rendered for room/bed inquiry intents.
 * - Zero database mutations (100% read-only).
 */

import { prisma } from "@/libs/prismaDb";
import { SupportedIntentType } from "./capabilityRegistry";
import { parseIntentWithGroq } from "./groqClient";

export type RoomBedIntentType = SupportedIntentType;

function formatINR(amount: number): string {
	return `₹${amount.toLocaleString("en-IN")}`;
}

export interface ConversationContext {
	lastQueriedRoomNumber?: string | null;
	lastIntent?: RoomBedIntentType;
	lastAttribute?: "RENT" | "AC" | "BEDS" | "SHARING" | "STATUS" | "UNSUPPORTED";
	activePropertyId?: string;
	timestamp?: number; // Epoch ms for time-to-live check (5 min expiry)
}

export interface ParsedRoomBedIntent {
	type: RoomBedIntentType;
	roomNumber?: string;
	sharingType?: "SINGLE" | "DOUBLE" | "TRIPLE" | "FOUR";
	acType?: "AC" | "NON_AC";
	specificQueryFocus?:
		"RENT" | "AC" | "BEDS" | "SHARING" | "STATUS" | "UNSUPPORTED";
	unsupportedAttribute?: string;
	originalQuery: string;
	confidence: number;
	detectedLanguage: "hi" | "en" | "gu" | "hinglish";
	clarificationNeeded?: boolean;
}

export interface BedDetail {
	id: string;
	bedNumber: number;
	status: string;
}

export interface RoomVacancyDetail {
	roomId: string;
	roomNumber: string;
	floor: string;
	sharing: string;
	acType: string;
	rentPerBed: number | null;
	totalBeds: number;
	availableBedCount: number;
	availableBedNumbers: number[];
}

export interface RoomBedQueryResult {
	success: boolean;
	intent: RoomBedIntentType;
	recognizedQuery: string;
	spokenAnswer: string;
	property: {
		id: string;
		name: string;
		city: string;
		type: string;
	};
	metrics: {
		totalRooms: number;
		roomsWithVacancy: number;
		totalBeds: number;
		availableBeds: number;
		occupiedBeds: number;
		maintenanceBeds: number;
	};
	vacantRooms: RoomVacancyDetail[];
	queriedRoom?: RoomVacancyDetail | null;
	context?: ConversationContext;
	suggestions?: string[];
}

// Convert Gujarati & Devanagari numerals to standard digits (e.g. '૧૦૨' / '१०२' -> '102')
export function normalizeIndicDigits(str: string): string {
	const gujaratiDigits = ["૦", "૧", "૨", "૩", "૪", "૫", "૬", "૭", "૮", "૯"];
	const devanagariDigits = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];
	let normalized = str;
	gujaratiDigits.forEach((digit, index) => {
		normalized = normalized.split(digit).join(String(index));
	});
	devanagariDigits.forEach((digit, index) => {
		normalized = normalized.split(digit).join(String(index));
	});
	return normalized;
}

const UNSUPPORTED_ROOM_ATTRIBUTES_REGEX =
	/(?:wifi|wi-fi|internet|food|khana|meal|mess|bathroom|washroom|attached|deposit|security\s*deposit|balcony|laundry|curfew|timing|rules)/i;

function extractUnsupportedAttribute(text: string): string | undefined {
	const match = text.match(UNSUPPORTED_ROOM_ATTRIBUTES_REGEX);
	if (!match) return undefined;
	const m = match[0].toLowerCase();
	if (m.includes("wifi") || m.includes("internet")) return "Wi-Fi";
	if (
		m.includes("food") ||
		m.includes("khana") ||
		m.includes("meal") ||
		m.includes("mess")
	)
		return "Food / Mess";
	if (m.includes("bath") || m.includes("wash") || m.includes("attached"))
		return "Attached Bathroom";
	if (m.includes("deposit")) return "Security Deposit";
	if (m.includes("balcony")) return "Balcony";
	if (m.includes("laundry")) return "Laundry";
	return "Curfew / Rules";
}

function extractPersonName(query: string): string | undefined {
	const patterns = [
		/([^\s,?.!]+)\s*(?:नेम\s*का|नाम\s*का|नाम\s*के|नाम\s*की|naam\s*ka|name\s*ka)/i,
		/(?:नाम\s*पे|नाम\s*पर|naam\s*pe|naam\s*se)\s+([^\s,?.!]+)/i,
		/(?:ke\s*naam\s*pe|के\s*नाम\s*पे|के\s*नाम\s*पर)\s*([^\s,?.!]+)/i,
		/(?:for|named|resident)\s+([a-zA-Z]+)/i,
	];
	for (const p of patterns) {
		const m = query.match(p);
		if (m && m[1]) {
			const candidate = m[1].trim();
			const stopWords = [
				"ac",
				"room",
				"bed",
				"pg",
				"new",
				"naya",
				"non_ac",
				"non",
				"ka",
				"ke",
				"ki",
				"hai",
				"ko",
				"se",
				"mein",
				"ek",
				"do",
			];
			if (!stopWords.includes(candidate.toLowerCase())) {
				return candidate;
			}
		}
	}
	return undefined;
}

/**
 * Normalizes colloquial words for numbers and sharing types
 */
function normalizeQueryTokens(raw: string): string {
	let lower = normalizeIndicDigits(raw || "")
		.trim()
		.toLowerCase();

	// Strip leading conversational fillers: "bhai", "bhaiya", "bro", "dost", "arre", "yaar"
	lower = lower.replace(/^(?:bhai|bhaiya|bro|dost|arre|yaar|hey)\s*,?\s*/i, "");

	// Normalize colloquial spelling variants
	lower = lower.replace(/\bkhaali\b/gi, "khali");

	// Replace Indic & English word numerals right after room keywords
	lower = lower
		.replace(
			/(?:room|kamra|kamre|kamro|રૂમ|ઓરડો|रूम|कमरा|कमरे)\s+(?:ek|एक|one|૧|१)\b/gi,
			"room 1"
		)
		.replace(
			/(?:room|kamra|kamre|kamro|રૂમ|ઓરડો|रूम|कमरा|कमरे)\s+(?:do|दो|two|૨|२)\b/gi,
			"room 2"
		)
		.replace(
			/(?:room|kamra|kamre|kamro|રૂમ|ઓરડો|रूम|कमरा|कमरे)\s+(?:teen|तीन|three|૩|૩)\b/gi,
			"room 3"
		)
		.replace(
			/(?:room|kamra|kamre|kamro|રૂમ|ઓરડો|रूम|कमरा|कमरे)\s+(?:char|chaar|चार|four|૪|४)\b/gi,
			"room 4"
		)
		.replace(
			/(?:room|kamra|kamre|kamro|રૂમ|ઓરડો|रूम|कमरा|कमरे)\s+(?:paanch|panch|पांच|five|૫|૫)\b/gi,
			"room 5"
		);

	return lower;
}

/**
 * Detects approximate utterance language
 */
function detectUtteranceLanguage(
	query: string
): "hi" | "en" | "gu" | "hinglish" {
	if (/[\u0A80-\u0AFF]/.test(query)) return "gu";
	if (/[\u0900-\u097F]/.test(query)) return "hi";
	const lower = query.toLowerCase();
	if (
		/^(?:which|what|how\s+many|is|are|list|show|check|available|tell|who|hello|thanks|thank\s+you|can\s+you|could\s+you|please)\b/i.test(
			lower
		)
	) {
		return "en";
	}
	return "hinglish";
}

/**
 * Layer A: Deterministic Understanding (Zero LLM Tokens).
 * Highly optimized, deterministic classifier for all standard PG operations.
 */
export function parseRoomBedIntent(
	rawQuery: string,
	context?: ConversationContext
): ParsedRoomBedIntent {
	const query = normalizeIndicDigits(rawQuery || "").trim();
	const lower = normalizeQueryTokens(query);
	const detectedLanguage = detectUtteranceLanguage(query);

	// Context validity check (5 min TTL)
	const isContextValid = Boolean(
		context?.lastQueriedRoomNumber &&
		(!context.timestamp || Date.now() - context.timestamp <= 5 * 60 * 1000)
	);

	// 1. Explicit Specific Room Query (Supports Latin, Devanagari Hindi, and Gujarati)
	// Examples: "Room 102", "Room number 1 ka status bata", "Room 102 mein kitne beds khali hain", "कमरा 1", "રૂમ ૧૦૧"
	const roomMatch =
		lower.match(
			/(?:room|rm|kamra|kamre|kamro|ઓરડો|ઓરડા|રૂમ|रूम|कमरा|कमरे|कमरों)\s*(?:number|no|num|नंबर|નંબર)?\.?\s*\b([a-z0-9\-_]*\d+[a-z0-9\-_]*)\b/i
		) ||
		lower.match(
			/\b([a-z0-9\-_]*\d+[a-z0-9\-_]*)\b\s*(?:number|no|नंबर|નંબર)?\s*(?:room|kamra|mein|ma|me|status|available|रूम|कमरा|में|માં)/i
		);

	if (roomMatch && roomMatch[1]) {
		const candidateRoomNo = roomMatch[1].toUpperCase();
		const unsupportedAttr = extractUnsupportedAttribute(lower);
		const specificQueryFocus = unsupportedAttr
			? "UNSUPPORTED"
			: /(?:rent|kiraya|bhav|rate|price|किराया|भाड़ा)/i.test(lower)
				? "RENT"
				: /(?:ac|a\/c|non-ac|एसी|ऐसी|એસી)/i.test(lower)
					? "AC"
					: /(?:sharing|single|double|triple|four)/i.test(lower)
						? "SHARING"
						: "BEDS";

		return {
			type: "SPECIFIC_ROOM_BEDS",
			roomNumber: candidateRoomNo,
			specificQueryFocus,
			unsupportedAttribute: unsupportedAttr,
			originalQuery: query,
			confidence: 0.95,
			detectedLanguage,
		};
	}

	// 2. Short Conversational Room Numbers (e.g. "102?", "aur 102?", "room 1?")
	const shortRoomMatch = lower.match(
		/^(?:aur|and|what about|ke)?\s*([a-z0-9\-_]*\d+[a-z0-9\-_]*)\s*(?:mein|ma|me|status)?\??$/i
	);
	if (shortRoomMatch && shortRoomMatch[1]) {
		return {
			type: "SPECIFIC_ROOM_BEDS",
			roomNumber: shortRoomMatch[1].toUpperCase(),
			specificQueryFocus: "BEDS",
			originalQuery: query,
			confidence: 0.9,
			detectedLanguage,
		};
	}

	// 3. Conversational Follow-up References using Context:
	// Examples: "Uska rent kitna hai?", "Aur AC?", "Wahan kitne beds khali hain?", "Pichhle wale room ki baat kar raha hoon", "Woh wala room"
	if (isContextValid && context?.lastQueriedRoomNumber) {
		const lastRoom = context.lastQueriedRoomNumber;

		// Unsupported room attribute follow-up (e.g., "Uska deposit kitna hai?", "Wifi hai?")
		const unsupportedFollowUp = extractUnsupportedAttribute(lower);
		if (unsupportedFollowUp) {
			return {
				type: "SPECIFIC_ROOM_BEDS",
				roomNumber: lastRoom,
				specificQueryFocus: "UNSUPPORTED",
				unsupportedAttribute: unsupportedFollowUp,
				originalQuery: query,
				confidence: 0.92,
				detectedLanguage,
			};
		}

		// Rent follow-up
		const isFollowUpRent =
			/(?:us|is|iska|uska|room|kamra|रूम|कमरा|wahan|wahan ka)\s*(?:ka)?\s*(?:rent|kiraya|bhav|rate|price|किराया)/i.test(
				lower
			) ||
			/^(?:rent|kiraya|price|rate|किराया)\s*(?:kitna|kya|कितना)?\??$/i.test(
				lower
			) ||
			/^(?:kitna|ketlu|कितना)\s*(?:rent|kiraya|किराया)\??$/i.test(lower) ||
			lower === "uska rent" ||
			lower === "uska rent?";

		if (isFollowUpRent) {
			return {
				type: "SPECIFIC_ROOM_BEDS",
				roomNumber: lastRoom,
				specificQueryFocus: "RENT",
				originalQuery: query,
				confidence: 0.95,
				detectedLanguage,
			};
		}

		// AC follow-up (Supports: "Aur AC?", "और एसी?", "And AC?", "Uska AC status", "AC hai?")
		const isFollowUpAC =
			/(?:us|is|iska|uska|wahan|aur|and|और|અને)?\s*(?:ac|a\/c|non-ac|एसी|ऐसी|નોન\s*એસી|नॉन\s*एसी)\s*(?:hai|status|available|wala|छे)?\??/i.test(
				lower
			) && /(?:ac|a\/c|non-ac|एसी|ऐसी|એસી)/i.test(lower);

		if (isFollowUpAC) {
			return {
				type: "SPECIFIC_ROOM_BEDS",
				roomNumber: lastRoom,
				specificQueryFocus: "AC",
				originalQuery: query,
				confidence: 0.95,
				detectedLanguage,
			};
		}

		// Beds count follow-up ("Wahan kitne beds khali hain?", "Usme kitne beds?")
		const isFollowUpBeds =
			/(?:us|is|iska|uska|wahan|wahan pe)\s*(?:mein|pe)?\s*(?:kitne|kaunse|कितने)?\s*(?:beds|bed|bedon|बेड)/i.test(
				lower
			) ||
			/(?:wahan|usme)\s*(?:kitne|ketla|કેટલા|कितने)\s*(?:khali|available)/i.test(
				lower
			);

		if (isFollowUpBeds) {
			return {
				type: "SPECIFIC_ROOM_BEDS",
				roomNumber: lastRoom,
				specificQueryFocus: "BEDS",
				originalQuery: query,
				confidence: 0.95,
				detectedLanguage,
			};
		}

		// Direct relative reference: "Pichhle wale room ki baat kar raha hoon", "Woh wala room"
		const isPreviousRoomRef =
			/(?:pichhle|pichla|last|previous|woh|wohi|wahi|us)\s*(?:wale)?\s*(?:room|kamre|ki\s*baat)/i.test(
				lower
			);

		if (isPreviousRoomRef) {
			return {
				type: "SPECIFIC_ROOM_BEDS",
				roomNumber: lastRoom,
				specificQueryFocus: "STATUS",
				originalQuery: query,
				confidence: 0.95,
				detectedLanguage,
			};
		}
	}

	// 4. Booking / Admission Guidance Intent
	// Examples:
	// - "विदाउट एसी रूम जो है उसमें इनको ऐड कर लो राहुल नेम का"
	// - "Ek bed Ramesh ke naam book karna hai", "Booking kaise karein", "Admission lena hai"
	// - "Inko add kar lo Rahul naam ka", "Rahul ko room mein add kar lo"
	const hasNonACInBooking =
		/(?:non[\s\-_]*ac|bina[\s\-_]*ac|without[\s\-_]*ac|विदाउट[\s\-_]*एसी|विथाउट[\s\-_]*एसी|विदाउट|विथाउट|વિધાઉટ|नॉन[\s\-_]*एसी|નૉન[\s\-_]*એસી|વિના[\s\-_]*એસી|गैर[\s\-_]*एसी)/i.test(
			lower
		);
	const hasACInBooking =
		hasNonACInBooking ||
		/(?:\bac\b|\ba\/c\b|\ba\.c\.\b|एसी|ऐसी|ए\s*सी|ए\.सी\.|એસી|એ\.સી\.)/i.test(
			lower
		);

	const isBookingQuery =
		/(?:book|booking|बुक|बूक|બુક|admission|एडमिशन|दाखिला|admit|add\s*resident|resident\s*add|naya\s*resident|tenant\s*add|naam\s*pe\s*book|naam\s*pe|naam\s*se|ke\s*naam\s*pe|ke\s*naam\s*par|नाम\s*पे|नाम\s*पर)/i.test(
			lower
		) ||
		(/(?:ऐड\s*कर\s*लो|एड\s*कर\s*लो|add\s*kar\s*lo|add\s*karo|ऐड\s*करो|एड\s*करो|रख\s*लो|रहने\s*के\s*लिए|दाखिल)/i.test(
			lower
		) &&
			/(?:नेम\s*का|नाम\s*का|नाम\s*के|नाम\s*की|name\s*ka|naam\s*ka|naam\s*ke|inko|isko|inhe|unhe|इनको|इसको|इन्हें|उन्हें|resident|tenant)/i.test(
				lower
			)) ||
		/(?:नेम\s*का|नाम\s*का|नाम\s*के)\b/i.test(lower);

	if (isBookingQuery) {
		const acType = hasNonACInBooking
			? "NON_AC"
			: hasACInBooking
				? "AC"
				: undefined;
		return {
			type: "BOOKING_OR_ADMISSION",
			acType,
			originalQuery: query,
			confidence: 0.95,
			detectedLanguage,
		};
	}

	// 5. Checkout Guidance Intent
	// Examples: "Ek resident checkout kar raha hai", "Resident chhod raha hai", "Checkout kaise karein?"
	const isCheckoutQuery =
		/(?:checkout|check-out|चेकआउट|leave|chhod\s*raha|chhodna|nikalna|khali\s*karwana|deposit\s*refund|deposit\s*wapas)/i.test(
			lower
		);

	if (isCheckoutQuery) {
		return {
			type: "CHECKOUT_OR_EXIT",
			originalQuery: query,
			confidence: 0.95,
			detectedLanguage,
		};
	}

	// 5b. Room & Bed Creation Guidance Intent (Zero DB mutations via voice)
	// Examples:
	// - "एक न्यू एसी रूम एड कर दो", "एक रूम ऐड कर दो", "नया कमरा बना दो", "नया रूम जोड़ दो"
	// - "Ek naya room add kar do", "Add a new AC room", "Room add karna hai", "Create new room"
	// - "Bed add kar do", "Naya bed kaise add karein", "રૂમ ઉમેરો", "રૂમ બનાવો"
	const isRoomCreationQuery =
		/(?:add\s*room|room\s*add|naya\s*room|naye\s*room|new\s*room|room\s*create|create\s*room|banao\s*room|room\s*banao|add\s*bed|bed\s*add|naya\s*bed|kamra\s*add|kamra\s*jod|kamra\s*banao|kamra\s*create|बनाओ|બનાવો|ઉમેરો|जोड़|जोड़)/i.test(
			lower
		) &&
		/(?:room|kamra|kamre|कमरा|कमरे|रूम|રૂમ|bed|beds|बेड|બેડ)/i.test(lower) &&
		/(?:add|create|new|naya|naye|new\s*ac|एड|ऐड|नया|नए|न्यू|जोड़|जोड़|बना|ઉમેર|બનાવ)/i.test(
			lower
		);

	if (
		isRoomCreationQuery ||
		/(?:room\s*add|add\s*room|room\s*create|create\s*room|naya\s*room\s*add|रूम\s*एड|रूम\s*ऐड|कमरा\s*एड|कमरा\s*ऐड|कमरा\s*जोड़|कमरा\s*जोड़|रूम\s*जोड़|रूम\s*जोड़|नया\s*रूम\s*एड|न्यू\s*रूम\s*एड|રૂમ\s*ઉમેરો)/i.test(
			lower
		) ||
		(/(?:add|create|एड|ऐड|जोड़|जोड़|ઉમેરો)\b/i.test(lower) &&
			/(?:room|kamra|kamre|कमरा|कमरे|रूम|રૂમ|bed|beds|बेड|બેડ)/i.test(lower))
	) {
		return {
			type: "ROOM_CREATION_GUIDANCE",
			originalQuery: query,
			confidence: 0.95,
			detectedLanguage,
		};
	}

	// 6. Payment Collection & Resident Financial Dues Query (Database Grounded)
	// Examples:
	// - "Kiska payment baki hai?", "Kiska rent pending hai?", "Kis kis ka baki hai?"
	// - "किसका पेमेंट बाकी है", "किसका किराया बाकी है", "કોનું ભાડું બાકી છે"
	// - "Rahul ka rent baki hai kya?", "Rahul kaunse room mein rehta hai?", "Rahul ki details"
	const isPaymentHistoryOrDues =
		/(?:kiska\s*payment|kiska\s*rent|kiska\s*baaki|kiska\s*baki|kis\s*kis\s*ka|kis\s*ka\s*rent|pending\s*rent|rent\s*pending|payment\s*pending|pending\s*dues|dues\s*kitne|kis\s*ka\s*payment|किसका\s*पेमेंट|किसका\s*किराया|किसका\s*बाकी|किस\s*किस\s*का|बाकी\s*पेमेंट|કોનું\s*ભાડું|કોનું\s*પેમેન્ટ|કેટલું\s*ભાડું\s*બાકી)/i.test(
			lower
		) ||
		/(?:mera\s*rent|rent\s*kitna\s*pending|kitna\s*pending|kitni\s*payment|payment\s*collect\s*hui|paid\s*hai\s*ya\s*pending|rent\s*paid|kitna\s*collection|hisab\s*dikhao|collection\s*kitna|kitna\s*aaya|kitna\s*baaki)/i.test(
			lower
		) ||
		(/(?:ka\s*payment|ka\s*rent|ka\s*hisab|ka\s*data|ki\s*details|ke\s*details|का\s*पेमेंट|का\s*किराया|का\s*हिसाब|की\s*डिटेल्स|kaunse\s*room\s*mein\s*rehta|kis\s*room\s*mein\s*rehta|कौन\s*से\s*रूम\s*में\s*रहता|kaunse\s*room\s*mein|kis\s*room\s*mein)\b/i.test(
			lower
		) &&
			!/(?:total|available|khali|empty|sharing|single|double|triple|four|शेयरिंग)/i.test(
				lower
			));

	if (isPaymentHistoryOrDues) {
		return {
			type: "PAYMENT_HISTORY_OR_DUES",
			originalQuery: query,
			confidence: 0.95,
			detectedLanguage,
		};
	}

	const isPaymentGuidance =
		/(?:payment\s*report|payment\s*record|payment\s*entry|kiraya\s*jama|receipt\s*generate|रसीद|report\s*dikhao|payment\s*kaise)/i.test(
			lower
		);

	if (isPaymentGuidance) {
		return {
			type: "PAYMENT_COLLECTION_GUIDANCE",
			originalQuery: query,
			confidence: 0.9,
			detectedLanguage,
		};
	}

	// 7. Resident Check-ins & Count
	// Examples: "Aaj kitne residents check-in hue?", "Kitne residents hain?", "Active residents kitne hain?"
	const isResidentQuery =
		/(?:kitne\s*residents|residents\s*check-in|residents\s*checkin|check-in\s*hue|checkin\s*hue|checkin\s*hua|aaj\s*kitne|active\s*residents|total\s*residents|kitne\s*log\s*rehte)/i.test(
			lower
		) && !/(?:rooms|room|kamra|beds|bed)/i.test(lower);

	if (isResidentQuery) {
		return {
			type: "RESIDENT_CHECKINS_OR_COUNT",
			originalQuery: query,
			confidence: 0.95,
			detectedLanguage,
		};
	}

	// 8. Simplified Language Request
	// Examples: "Samajh nahi aaya, simple language mein batao.", "Aasan bhasha mein samjhao"
	const isSimplifiedQuery =
		/(?:samajh\s*nahi\s*aaya|simple\s*language|aasan\s*bhasha|simple\s*bhasha|aasan\s*tarike|seedhi\s*baat)/i.test(
			lower
		);

	if (isSimplifiedQuery) {
		return {
			type: "SIMPLIFIED_EXPLANATION",
			originalQuery: query,
			confidence: 0.95,
			detectedLanguage,
		};
	}

	// 9. General Amenities / Deposits queries (e.g. "Kya room mein wifi hai?", "Mess ka khana", "Deposit kitna hai")
	const unsupportedGeneralAttr = extractUnsupportedAttribute(lower);
	if (unsupportedGeneralAttr) {
		return {
			type: "AMENITIES_OR_DEPOSITS",
			unsupportedAttribute: unsupportedGeneralAttr,
			originalQuery: query,
			confidence: 0.95,
			detectedLanguage,
		};
	}

	// 8. Sharing Type Rent Rates Query
	// Examples: "Triple sharing ka kitna rent hai?", "Double sharing ka rent kya hai?", "Single room rent"
	const hasSharingRentKeyword = /(?:rent|kiraya|bhav|rate|price|किराया)/i.test(
		lower
	);
	const hasSharingKeyword =
		/(?:single|double|triple|four|1\s*sharing|2\s*sharing|3\s*sharing|4\s*sharing|ट्रिपल|डबल|सिंगल)/i.test(
			lower
		);

	if (
		hasSharingKeyword &&
		(hasSharingRentKeyword || lower.includes("sharing"))
	) {
		let sharingType: "SINGLE" | "DOUBLE" | "TRIPLE" | "FOUR" = "TRIPLE";
		if (
			lower.includes("single") ||
			lower.includes("सिंगल") ||
			lower.includes("1 sharing") ||
			lower.includes("1 bed")
		) {
			sharingType = "SINGLE";
		} else if (
			lower.includes("double") ||
			lower.includes("डबल") ||
			lower.includes("2 sharing") ||
			lower.includes("2 bed")
		) {
			sharingType = "DOUBLE";
		} else if (
			lower.includes("four") ||
			lower.includes("4 sharing") ||
			lower.includes("4 bed")
		) {
			sharingType = "FOUR";
		}

		return {
			type: "ROOM_SHARING_RENT",
			sharingType,
			specificQueryFocus: "RENT",
			originalQuery: query,
			confidence: 0.95,
			detectedLanguage,
		};
	}

	// 9. Total Rooms Query
	// Examples: "Mere PG mein kitne rooms hain?", "Total rooms kitne hain?", "How many total rooms in PG?"
	const isTotalRoomsQuery =
		/(?:kitne|how many|total|ketla|કેટલા|कुल)\s*(?:rooms|room|kamre|kamra|ઓરડા|રૂમ|कमरा|कमरे)\s*(?:hain|che|in\s*pg|pg\s*mein|total)?/i.test(
			lower
		) &&
		!/(?:khali|khaali|available|vacancy|vacant|uplabdh|empty|ખાલી|उपलब्ध|free)/i.test(
			lower
		);

	if (isTotalRoomsQuery) {
		return {
			type: "TOTAL_ROOMS",
			originalQuery: query,
			confidence: 0.95,
			detectedLanguage,
		};
	}

	// 10. AC / Non-AC Room Availability Filter Query
	// Examples:
	// - "Koi AC wala room khali hai?", "कोई एसी वाला रूम खाली है", "एसी वाला कमरा खाली है क्या"
	// - "Non-AC room khali hai?", "नॉन एसी रूम बताओ", "Is any AC room available?"
	// - "AC rooms batao", "Koi AC wala room hai?", "Khali AC rooms", "એસી રૂમ ખાલી છે"
	const hasNonACMention =
		/(?:non[\s\-_]*ac|bina[\s\-_]*ac|without[\s\-_]*ac|विदाउट[\s\-_]*एसी|विथाउट[\s\-_]*एसी|विदाउट|विथाउट|વિધાઉટ|નૉન[\s\-_]*એસી|વિના[\s\-_]*એસી|नॉन[\s\-_]*एसी|नॉन[\s\-_]*ऐसी|नॉन[\s\-_]*ए\s*सी|बिना[\s\-_]*एसी|गैर[\s\-_]*एसी|નોન[\s\-_]*એસી)/i.test(
			lower
		);
	const hasACMention =
		hasNonACMention ||
		/(?:\bac\b|\ba\/c\b|\ba\.c\.\b|एसी|ऐसी|ए\s*सी|ए\.सी\.|એસી|એ\.સી\.)/i.test(
			lower
		);

	const hasRoomOrInquiry =
		/(?:room|rooms|kamra|kamre|kamro|कमरा|कमरे|रूम|રૂમ|ઓરડો|ઓરડા)/i.test(
			lower
		) ||
		/(?:khali|available|free|uplabdh|खाली|उपलब्ध|ખાલી)/i.test(lower) ||
		/(?:koi|kya|batao|dikhao|list|show|check|hai|any|is\s*there|tell|बताओ|दिखाओ|છે|બતાવો)/i.test(
			lower
		);

	const hasActionVerb =
		/(?:add|create|delete|remove|update|book|edit|एड|ऐड|जोड़|जोड़|हटा|डिलीट|બનાવો|ઉમેરો|रख\s*लो|दाखिल|नेम\s*का|नाम\s*का)/i.test(
			lower
		);
	const isACRoomFilterQuery =
		hasACMention && hasRoomOrInquiry && !hasActionVerb;

	if (isACRoomFilterQuery) {
		return {
			type: "AC_ROOM_AVAILABILITY",
			acType: hasNonACMention ? "NON_AC" : "AC",
			originalQuery: query,
			confidence: 0.95,
			detectedLanguage,
		};
	}

	// 11. Capabilities & Help Queries
	// Examples: "Tum kya kya kar sakte ho?", "Tum kya-kya kar sakte ho?", "Help karo", "What can you do?"
	const isHelpQuery =
		/(?:kya[- ]*(?:kya)?\s*(?:kar|bata)\s*sakte|what\s*(?:can)?\s*you\s*do|tum\s*kya|aap\s*kya|kaise\s*madad|kaise\s*help|help\s*me|help\s*karo|kaise\s*use\s*karein|shuru\s*karein|kya\s*(?:kar|bata)\s*sakta|क्या\s*(?:क्या)?\s*(?:कर|बता)\s*सकते|मदद|તમે\s*શું\s*(?:કરી|કહી)\s*શકો)/i.test(
			lower
		) ||
		lower === "help" ||
		lower === "madad" ||
		lower === "who are you";

	if (isHelpQuery) {
		return {
			type: "CAPABILITIES_OR_HELP",
			originalQuery: query,
			confidence: 0.95,
			detectedLanguage,
		};
	}

	// 12. Pure Gratitude / Thanks (including casual acknowledgments)
	// Examples: "Thank you", "Dhanyawad", "Theek hai", "Achha", "Okay", "Samajh gaya"
	const isThanksQuery =
		/^(?:thank\s*you|thanks|dhanyawad|shukriya|aabhar|धन्यवाद|शुक्रिया|આભાર|thx)\b/i.test(
			lower.trim()
		) ||
		/^(?:theek\s*hai|theek|thik|accha|achha|okay|ok|got\s*it|samajh\s*gaya|samajh\s*gaye|samajha|ठीक\s*है|ठीक|अच्छा|समझ\s*गया)\s*[.!,]?$/i.test(
			lower.trim()
		);

	if (isThanksQuery) {
		return {
			type: "THANKS",
			originalQuery: query,
			confidence: 0.95,
			detectedLanguage,
		};
	}

	// 13. Available Beds Query
	// Examples: "Kitne beds available hai?", "Kitne beds khali hain?", "Total ketla bed khali che?", "મારા PG માં કેટલા બેડ ખાલી છે?"
	const isBedsQuery =
		/(?:kitne|how many|total|ketla|કેટલા|કેટલાં|કેટલા બેડ|કુલ)\s*(?:beds|bed|bedon|બેડ|બેટ|बेड|बिस्तर)/i.test(
			lower
		) ||
		/(?:beds|bed|બેડ|बेड|बिस्तर)\s*(?:available|khali|khaali|uplabdh|empty|ઉપલબ્ધ|ખાલી|खाली|उपलब्ध|છે)/i.test(
			lower
		) ||
		/(?:kaunse|which|kya|કયા|कौन|कौनसे|कौन सा|कौन से)\s*(?:beds|bed|બેડ|बेड|बिस्तर)/i.test(
			lower
		) ||
		(lower.includes("બેડ") &&
			(lower.includes("ખાલી") ||
				lower.includes("કેટલા") ||
				lower.includes("ઉપલબ્ધ"))) ||
		(lower.includes("बेड") &&
			(lower.includes("खाली") || lower.includes("उपलब्ध")));

	// 14. Available Rooms Query
	// Examples: "Kaunse room khali hain?", "Which rooms are available?", "रूम कौन से खाली हैं", "કયા રૂમ ખાલી છે"
	const isRoomsQuery =
		/(?:rooms|room|kamre|kamra|kamro|ઓરડા|રૂમ|रूम|कमरा|कमरे|कमरों)\s*(?:available|khali|khaali|uplabdh|empty|ખાલી|ઉપલબ્ધ|खाली|उपलब्ध)/i.test(
			lower
		) ||
		/(?:kaunse|which|kya|list|show|કયા|कौन|कौनसे|कौन सा|कौन से)\s*(?:rooms|room|kamre|kamra|ઓરડા|રૂમ|रूम|कमरा|कमरे|कमरों)/i.test(
			lower
		) ||
		/(?:khali|khaali|available|empty|ખાલી|खाली|उपलब्ध)\s*(?:rooms|room|kamra|kamre|રૂમ|रूम|कमरा|कमरे)/i.test(
			lower
		) ||
		/(?:aur|dusre|baki)\s*(?:kaunse|rooms|khali)/i.test(lower) ||
		((lower.includes("रूम") ||
			lower.includes("कमरा") ||
			lower.includes("कमरे") ||
			lower.includes("room")) &&
			(lower.includes("खाली") ||
				lower.includes("उपलब्ध") ||
				lower.includes("khali") ||
				lower.includes("available")));

	if (isBedsQuery && !isRoomsQuery) {
		return {
			type: "AVAILABLE_BEDS",
			originalQuery: query,
			confidence: 0.9,
			detectedLanguage,
		};
	}

	if (isRoomsQuery) {
		return {
			type: "AVAILABLE_ROOMS",
			originalQuery: query,
			confidence: 0.9,
			detectedLanguage,
		};
	}

	// 15. Pure Greeting + conversational one-word responses
	// Examples: "Hello", "Namaste", "Hi", "Haan", "नहीं", "Nahi", "Ji"
	const isGreetingQuery =
		/^(?:hello\s*dost|hello|hi|hey|namaste|namaskar|kem\s*cho|kem\s*chho|kaise\s*ho|kya\s*haal|ram\s*ram|good\s*morning|good\s*evening|हेलो|नमस्ते|હેલો)(?:\s+.*)?$/i.test(
			lower
		) ||
		/^(?:hi|hey|hello|हेलो|नमस्ते)\s*$/i.test(lower.trim()) ||
		/(?:namaste\s*,?\s*kaise\s*ho|kaise\s*ho\s*bhai)/i.test(lower) ||
		/^(?:haan|nahi|nah|nahin|ji|ji\s*haan|ji\s*nahi|acha\s*ji|arre|hmm|hm|हाँ|नहीं|नही|ना|जी|हम्म)\s*[.!,]?$/i.test(
			lower.trim()
		);

	if (isGreetingQuery) {
		return {
			type: "GREETING",
			originalQuery: query,
			confidence: 0.95,
			detectedLanguage,
		};
	}

	// 16. Single Keyword Fallbacks
	if (
		lower === "rooms" ||
		lower === "khali rooms" ||
		lower === "available rooms" ||
		lower === "रूम" ||
		lower === "कमरे" ||
		lower === "खाली room" ||
		lower === "room khali" ||
		lower === "rooms khali"
	) {
		return {
			type: "AVAILABLE_ROOMS",
			originalQuery: query,
			confidence: 0.85,
			detectedLanguage,
		};
	}

	if (
		lower === "beds" ||
		lower === "khali beds" ||
		lower === "available beds" ||
		lower === "बेड" ||
		lower === "बिस्तर"
	) {
		return {
			type: "AVAILABLE_BEDS",
			originalQuery: query,
			confidence: 0.85,
			detectedLanguage,
		};
	}

	// 17. Orphan Contextual Follow-up without room in context -> ask which room!
	const isOrphanFollowUp =
		/^(?:aur|and|और|અને)?\s*(?:ac|a\/c|non-ac|एसी|ऐसी|rent|kiraya|किराया|beds?|status)\s*\??$/i.test(
			lower.trim()
		) || /(?:uska|iska|wahan|wahan ka)\s*(?:rent|ac|status|beds)/i.test(lower);

	if (isOrphanFollowUp) {
		return {
			type: "CLARIFICATION_NEEDED",
			originalQuery: query,
			confidence: 0.9,
			detectedLanguage,
		};
	}

	// Default: Ambiguous / Unclassified in Layer A
	return {
		type: "AMBIGUOUS_OR_UNSUPPORTED",
		originalQuery: query,
		confidence: 0.3,
		detectedLanguage,
	};
}

/**
 * Layer B: Hybrid Resolver.
 * Uses Layer A (Deterministic) first. Only delegates to Groq LLM if confidence is low (< 0.75).
 */
export async function resolveRoomBedIntent(
	rawQuery: string,
	context?: ConversationContext
): Promise<ParsedRoomBedIntent> {
	// Step 1: Run Layer A deterministic parser
	const deterministic = parseRoomBedIntent(rawQuery, context);

	// If Layer A is confident (>= 0.75), return immediately with ZERO token cost!
	if (
		deterministic.confidence >= 0.75 &&
		deterministic.type !== "AMBIGUOUS_OR_UNSUPPORTED"
	) {
		return deterministic;
	}

	// Step 2: Call Groq LLM only for ambiguous/unrecognized queries
	if (process.env.GROQ_API_KEY?.trim()) {
		const groqResult = await parseIntentWithGroq(rawQuery, {
			lastRoom: context?.lastQueriedRoomNumber || undefined,
		});

		if (groqResult && groqResult.intent) {
			return {
				type: groqResult.intent,
				roomNumber: groqResult.roomNumber || undefined,
				sharingType: groqResult.sharingType || undefined,
				acType: groqResult.acType || undefined,
				specificQueryFocus:
					(groqResult.attribute as any) || deterministic.specificQueryFocus,
				originalQuery: rawQuery,
				confidence: groqResult.confidence,
				detectedLanguage: deterministic.detectedLanguage,
				clarificationNeeded: groqResult.needsClarification,
			};
		}
	}

	return deterministic;
}

/**
 * Layer C: Database-Grounded Execution.
 * Authorized multi-tenant execution against live PostgreSQL/Prisma records.
 */
export async function executeRoomBedQuery(
	ownerId: string,
	intent: ParsedRoomBedIntent,
	preferredPropertyId?: string
): Promise<RoomBedQueryResult> {
	// 1. Authoritative property verification (lean select for Supabase RAM optimization)
	const properties = await prisma.property.findMany({
		where: { ownerId },
		orderBy: { createdAt: "asc" },
		select: { id: true, name: true, city: true, type: true },
	});

	if (properties.length === 0) {
		return {
			success: false,
			intent: intent.type,
			recognizedQuery: intent.originalQuery,
			spokenAnswer:
				"Aapke account mein koi PG registered nahi hai. Kripya pehle setup complete karein.",
			property: { id: "", name: "No Property", city: "", type: "" },
			metrics: {
				totalRooms: 0,
				roomsWithVacancy: 0,
				totalBeds: 0,
				availableBeds: 0,
				occupiedBeds: 0,
				maintenanceBeds: 0,
			},
			vacantRooms: [],
			suggestions: ["Go to /user/setup to register your PG"],
		};
	}

	// Choose authorized property
	const activeProperty =
		(preferredPropertyId
			? properties.find((p) => p.id === preferredPropertyId)
			: null) || properties[0];

	// 2. Fetch all rooms and beds with strictly lean select
	const rooms = await prisma.room.findMany({
		where: { propertyId: activeProperty.id },
		orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
		select: {
			id: true,
			roomNumber: true,
			floor: true,
			sharing: true,
			acType: true,
			rentPerBed: true,
			beds: {
				select: {
					id: true,
					bedNumber: true,
					status: true,
				},
				orderBy: { bedNumber: "asc" },
			},
		},
	});

	// Calculate authoritative vacancy metrics
	let totalBeds = 0;
	let availableBeds = 0;
	let occupiedBeds = 0;
	let maintenanceBeds = 0;
	const vacancyList: RoomVacancyDetail[] = [];

	rooms.forEach((r) => {
		const totalInRoom = r.beds.length;
		const availBeds = r.beds.filter((b) => b.status === "AVAILABLE");
		const occBeds = r.beds.filter((b) => b.status === "OCCUPIED");
		const maintBeds = r.beds.filter((b) => b.status === "MAINTENANCE");

		totalBeds += totalInRoom;
		availableBeds += availBeds.length;
		occupiedBeds += occBeds.length;
		maintenanceBeds += maintBeds.length;

		if (availBeds.length > 0) {
			vacancyList.push({
				roomId: r.id,
				roomNumber: r.roomNumber,
				floor: r.floor,
				sharing: r.sharing,
				acType: r.acType,
				rentPerBed: r.rentPerBed,
				totalBeds: totalInRoom,
				availableBedCount: availBeds.length,
				availableBedNumbers: availBeds.map((b) => b.bedNumber),
			});
		}
	});

	const metrics = {
		totalRooms: rooms.length,
		roomsWithVacancy: vacancyList.length,
		totalBeds,
		availableBeds,
		occupiedBeds,
		maintenanceBeds,
	};

	// -------------------------------------------------------------
	// INTENT HANDLERS: DATABASE GROUNDED ANSWERS (MULTILINGUAL)
	// -------------------------------------------------------------
	const lang = intent.detectedLanguage || "hinglish";

	// Handler: GREETING
	if (intent.type === "GREETING") {
		let spokenAnswer = "";
		if (lang === "hi") {
			spokenAnswer =
				"नमस्ते! मैं पीजी साथी हूँ। आप खाली रूम, उपलब्ध बेड्स, रूम का किराया और एसी स्टेटस पूछ सकते हैं।";
		} else if (lang === "gu") {
			spokenAnswer =
				"નમસ્તે! હું પીજી સાથી છું. તમે ખાલી રૂમ, ઉપલબ્ધ બેડ, રૂમ ભાડું અને એસી સ્ટેટસ પૂછી શકો છો.";
		} else if (lang === "en") {
			spokenAnswer =
				"Hello! I am PG Saathi. You can ask about room vacancy, available beds, room rent, and AC status.";
		} else {
			spokenAnswer =
				"Namaste! Main PG Saathi hoon. Aap room availability, bed count, room rent aur AC status pooch sakte hain.";
		}

		return {
			success: true,
			intent: intent.type,
			recognizedQuery: intent.originalQuery,
			spokenAnswer,
			property: activeProperty,
			metrics,
			vacantRooms: [], // No room cards for greetings
			suggestions: [
				lang === "hi"
					? "कौन से रूम खाली हैं?"
					: lang === "gu"
						? "કયા રૂમ ખાલી છે?"
						: lang === "en"
							? "Which rooms are available?"
							: "Kaunse room khali hain?",
				lang === "hi"
					? "कुल कितने बेड्स खाली हैं?"
					: lang === "gu"
						? "કુલ કેટલા બેડ ખાલી છે?"
						: lang === "en"
							? "How many beds are available?"
							: "Total kitne beds available hain?",
			],
		};
	}

	// Handler: THANKS
	if (intent.type === "THANKS") {
		let spokenAnswer = "";
		if (lang === "hi") {
			spokenAnswer = "आपका स्वागत है! अगर कोई और सवाल हो तो ज़रूर बताइए।";
		} else if (lang === "gu") {
			spokenAnswer = "તમારું સ્વાગત છે! જો બીજો કોઈ પ્રશ્ન હોય તો જરૂર જણાવો.";
		} else if (lang === "en") {
			spokenAnswer =
				"You're welcome! Let me know if you have any other questions.";
		} else {
			spokenAnswer =
				"Aapka swagat hai! Agar aur koi sawal ho toh zaroor batayein.";
		}

		return {
			success: true,
			intent: intent.type,
			recognizedQuery: intent.originalQuery,
			spokenAnswer,
			property: activeProperty,
			metrics,
			vacantRooms: [], // No room cards
			suggestions: [
				lang === "hi"
					? "कौन से रूम खाली हैं?"
					: lang === "gu"
						? "કયા રૂમ ખાલી છે?"
						: lang === "en"
							? "Which rooms are available?"
							: "Kaunse room khali hain?",
			],
		};
	}

	// Handler: CAPABILITIES_OR_HELP
	if (intent.type === "CAPABILITIES_OR_HELP") {
		let spokenAnswer = "";
		if (lang === "hi") {
			spokenAnswer =
				"मैं आपके पीजी के उपलब्ध रूम्स, बेड्स, शेयरिंग टाइप, एसी और रूम रेंट की जानकारी दे सकता हूँ। आप क्या देखना चाहते हैं?";
		} else if (lang === "gu") {
			spokenAnswer =
				"હું તમારા પીજીના ઉપલબ્ધ રૂમ, બેડ, શેરિંગ પ્રકાર, એસી અને ભાડાની વિગતો ચકાસી શકું છું. તમારે શું જોવું છે?";
		} else if (lang === "en") {
			spokenAnswer =
				"I can check available rooms, vacant beds, sharing types, AC status, and room rent for your PG. What would you like to check?";
		} else {
			spokenAnswer =
				"Main aapke PG ke available rooms, beds, sharing type, AC aur supported room rent details check kar sakta hoon. Kya dekhna hai?";
		}

		return {
			success: true,
			intent: intent.type,
			recognizedQuery: intent.originalQuery,
			spokenAnswer,
			property: activeProperty,
			metrics,
			vacantRooms: [], // No room cards for help
			suggestions: [
				lang === "hi"
					? "कौन से रूम खाली हैं?"
					: lang === "gu"
						? "કયા રૂમ ખાલી છે?"
						: lang === "en"
							? "Which rooms are available?"
							: "Kaunse room khali hain?",
				lang === "hi"
					? "कुल कितने बेड्स खाली हैं?"
					: lang === "gu"
						? "કુલ કેટલા બેડ ખાલી છે?"
						: lang === "en"
							? "How many beds are available?"
							: "Total kitne beds available hain?",
			],
		};
	}

	// Handler: TOTAL_ROOMS
	if (intent.type === "TOTAL_ROOMS") {
		let spokenAnswer = "";
		if (lang === "hi") {
			spokenAnswer = `आपके पीजी '${activeProperty.name}' में कुल ${rooms.length} रूम्स और ${totalBeds} बेड्स हैं। फ़िलहाल ${vacancyList.length} कमरों में ${availableBeds} बेड्स खाली हैं।`;
		} else if (lang === "gu") {
			spokenAnswer = `તમારા પીજી '${activeProperty.name}' માં કુલ ${rooms.length} રૂમ અને ${totalBeds} બેડ છે. હાલમાં ${vacancyList.length} રૂમમાં ${availableBeds} બેડ ખાલી છે.`;
		} else if (lang === "en") {
			spokenAnswer = `Your PG '${activeProperty.name}' has a total of ${rooms.length} room(s) and ${totalBeds} bed(s). Currently, ${availableBeds} bed(s) are vacant across ${vacancyList.length} room(s).`;
		} else {
			spokenAnswer = `Aapke PG '${activeProperty.name}' mein kul ${rooms.length} rooms aur ${totalBeds} beds hain. Filhal ${vacancyList.length} rooms mein ${availableBeds} beds khali hain.`;
		}

		return {
			success: true,
			intent: intent.type,
			recognizedQuery: intent.originalQuery,
			spokenAnswer,
			property: activeProperty,
			metrics,
			vacantRooms: [], // Total summary inquiry: no bulky card list
			suggestions: [
				lang === "hi" ? "कौन से रूम खाली हैं?" : "Kaunse room khali hain?",
				lang === "hi"
					? "कुल कितने बेड्स खाली हैं?"
					: "Total kitne beds available hain?",
			],
		};
	}

	// Handler: AC_ROOM_AVAILABILITY (Strictly filters on acType)
	if (intent.type === "AC_ROOM_AVAILABILITY") {
		const filterType = intent.acType || "AC";
		const filtered = vacancyList.filter((v) => v.acType === filterType);
		const count = filtered.reduce((sum, r) => sum + r.availableBedCount, 0);

		let spokenAnswer = "";
		if (filtered.length > 0) {
			const roomNames = filtered.map((r) => `Room ${r.roomNumber}`).join(", ");
			if (lang === "hi") {
				const catName = filterType === "AC" ? "एसी (AC)" : "नॉन-एसी (Non-AC)";
				spokenAnswer = `${catName} श्रेणी में ${filtered.length} कमरों में बेड्स खाली हैं (${roomNames})। कुल ${count} बेड्स उपलब्ध हैं।`;
			} else if (lang === "gu") {
				const catName = filterType === "AC" ? "એસી (AC)" : "નોન-એસી (Non-AC)";
				spokenAnswer = `${catName} કેટેગરીમાં ${filtered.length} રૂમમાં બેડ ખાલી છે (${roomNames}), કુલ ${count} બેડ ઉપલબ્ધ છે.`;
			} else if (lang === "en") {
				const catName = filterType === "AC" ? "AC" : "Non-AC";
				spokenAnswer = `In the ${catName} category, ${filtered.length} room(s) have available beds (${roomNames}), with a total of ${count} bed(s) available.`;
			} else {
				spokenAnswer = `${filterType} category mein ${filtered.length} rooms khali hain (${roomNames}), kul ${count} beds available hain.`;
			}
		} else {
			if (lang === "hi") {
				const catName = filterType === "AC" ? "एसी (AC)" : "नॉन-एसी (Non-AC)";
				spokenAnswer = `फ़िलहाल आपके पीजी में कोई भी ${catName} रूम खाली नहीं है।`;
			} else if (lang === "gu") {
				const catName = filterType === "AC" ? "એસી (AC)" : "નોન-એસી (Non-AC)";
				spokenAnswer = `હાલમાં તમારા પીજીમાં કોઈ ${catName} રૂમ ખાલી નથી.`;
			} else if (lang === "en") {
				const catName = filterType === "AC" ? "AC" : "Non-AC";
				spokenAnswer = `Currently, no ${catName} rooms with vacant beds are available in your PG.`;
			} else {
				spokenAnswer = `Filhal aapke PG mein koi bhi ${filterType} room khali nahi hai.`;
			}
		}

		return {
			success: true,
			intent: intent.type,
			recognizedQuery: intent.originalQuery,
			spokenAnswer,
			property: activeProperty,
			metrics,
			vacantRooms: filtered, // Strictly contains ONLY matching AC/NON_AC rooms; [] if none!
			suggestions: [
				lang === "hi" ? "कौन से रूम खाली हैं?" : "Kaunse room khali hain?",
				lang === "hi"
					? "कुल कितने बेड्स खाली हैं?"
					: "Total kitne beds available hain?",
			],
		};
	}

	// Handler: ROOM_SHARING_RENT
	if (intent.type === "ROOM_SHARING_RENT") {
		const targetSharing = intent.sharingType || "TRIPLE";
		const matchingRooms = rooms.filter(
			(r) => r.sharing.toUpperCase() === targetSharing
		);

		let spokenAnswer = "";
		if (matchingRooms.length > 0) {
			const sampleWithRent = matchingRooms.find((r) => r.rentPerBed != null);
			if (sampleWithRent?.rentPerBed) {
				const rentStr = formatINR(sampleWithRent.rentPerBed);
				if (lang === "hi") {
					spokenAnswer = `${targetSharing} शेयरिंग का किराया ${rentStr} प्रति बेड है। इस श्रेणी में ${matchingRooms.length} रूम्स हैं।`;
				} else if (lang === "gu") {
					spokenAnswer = `${targetSharing} શેરિંગનું ભાડું ${rentStr} પ્રતિ બેડ છે. આ કેટેગરીમાં ${matchingRooms.length} રૂમ છે.`;
				} else if (lang === "en") {
					spokenAnswer = `The rent for ${targetSharing} sharing is ${rentStr} per bed. There are ${matchingRooms.length} room(s) in this category.`;
				} else {
					spokenAnswer = `${targetSharing} sharing ka rent ${rentStr} per bed hai. Is category mein ${matchingRooms.length} rooms hain.`;
				}
			} else {
				if (lang === "hi") {
					spokenAnswer = `${targetSharing} शेयरिंग के कमरे कॉन्फ़िगर हैं पर किराया सेट नहीं है।`;
				} else {
					spokenAnswer = `${targetSharing} sharing ke rooms configure hain par rent set nahi hai.`;
				}
			}
		} else {
			if (lang === "hi") {
				spokenAnswer = `आपके पीजी में ${targetSharing} शेयरिंग का कोई रूम कॉन्फ़िगर नहीं है।`;
			} else {
				spokenAnswer = `Aapke PG mein ${targetSharing} sharing ka koi room configured nahi hai.`;
			}
		}

		return {
			success: true,
			intent: intent.type,
			recognizedQuery: intent.originalQuery,
			spokenAnswer,
			property: activeProperty,
			metrics,
			vacantRooms: vacancyList.filter((v) => v.sharing === targetSharing),
			suggestions: [
				lang === "hi" ? "कौन से रूम खाली हैं?" : "Kaunse room khali hain?",
				lang === "hi"
					? "कुल कितने बेड्स खाली हैं?"
					: "Total kitne beds available hain?",
			],
		};
	}

	// Handler: BOOKING_OR_ADMISSION (Guidance only)
	if (intent.type === "BOOKING_OR_ADMISSION") {
		const extractedName = extractPersonName(intent.originalQuery);
		const acPreference = intent.acType;

		let spokenAnswer = "";
		if (extractedName && acPreference === "NON_AC") {
			if (lang === "hi") {
				spokenAnswer = `${extractedName} को विदाउट एसी (Non-AC) रूम में ऐड करने के लिए आप Dashboard के Residents सेक्शन (/user/residents) में जाकर 'Add Resident' से नया एडमिशन करें। वॉयस से सीधे डेटाबेस में नया रेजिडेंट नहीं जोड़ा जाता। क्या मैं पहले खाली नॉन-एसी रूम्स चेक कर दूँ?`;
			} else if (lang === "gu") {
				spokenAnswer = `${extractedName} ને Non-AC રૂમમાં એડ કરવા માટે Dashboard ના Residents સેક્શનમાંથી 'Add Resident' કરો. શું હું પહેલા ખાલી Non-AC રૂમ બતાવું?`;
			} else if (lang === "en") {
				spokenAnswer = `To add ${extractedName} into a Non-AC room, please go to the Residents section (/user/residents) and click 'Add Resident'. Would you like me to check vacant Non-AC rooms first?`;
			} else {
				spokenAnswer = `${extractedName} ko Non-AC room mein add karne ke liye Dashboard ke Residents section (/user/residents) se 'Add Resident' karein. Voice se direct DB mein resident create nahi hota. Pehle khali Non-AC rooms check kar doon?`;
			}
		} else if (extractedName) {
			if (lang === "hi") {
				spokenAnswer = `${extractedName} के एडमिशन के लिए आप Dashboard के Residents सेक्शन (/user/residents) में जाकर 'Add Resident' से नया रेजिडेंट जोड़ सकते हैं। क्या मैं पहले खाली बेड्स चेक कर दूँ?`;
			} else if (lang === "gu") {
				spokenAnswer = `${extractedName} ના એડમિશન માટે Dashboard ના Residents સેક્શનમાંથી 'Add Resident' કરો. શું હું પહેલા ખાલી બેડ બતાવું?`;
			} else if (lang === "en") {
				spokenAnswer = `To admit ${extractedName}, please use 'Add Resident' in the Residents section (/user/residents). Shall I check available beds first?`;
			} else {
				spokenAnswer = `${extractedName} ke admission ke liye Dashboard ke Residents section (/user/residents) mein 'Add Resident' use karein. Pehle available beds check kar doon?`;
			}
		} else {
			if (lang === "hi") {
				spokenAnswer =
					"अभी मैं आवाज़ से सीधे बेड बुक नहीं कर सकता। आप Residents सेक्शन (/user/residents) में जाकर Add Resident का इस्तेमाल कर सकते हैं। क्या मैं पहले उपलब्ध बेड्स चेक कर दूँ?";
			} else if (lang === "gu") {
				spokenAnswer =
					"હાલમાં હું અવાજ દ્વારા સીધા બેડ બુક કરી શકતો નથી. તમે Residents સેક્શનમાં જઈને Add Resident નો ઉપયોગ કરી શકો છો. શું હું પહેલા ઉપલબ્ધ બેડ ચેક કરું?";
			} else if (lang === "en") {
				spokenAnswer =
					"Currently, I cannot book a bed directly via voice. You can use Add Resident in the Residents section (/user/residents). Shall I check available beds first?";
			} else {
				spokenAnswer =
					"Abhi main voice se bed book nahi kar sakta. Aap Residents section (/user/residents) mein jaakar Add Resident use kar sakte hain. Pehle available beds check kar doon?";
			}
		}

		return {
			success: true,
			intent: intent.type,
			recognizedQuery: intent.originalQuery,
			spokenAnswer,
			property: activeProperty,
			metrics,
			vacantRooms: [], // Guidance only: NO room cards
			suggestions: [
				acPreference === "NON_AC"
					? lang === "hi"
						? "नॉन एसी रूम बताओ"
						: "Non-AC room khali hai?"
					: lang === "hi"
						? "कौन से रूम खाली हैं?"
						: "Kaunse room khali hain?",
				lang === "hi"
					? "कुल कितने बेड्स खाली हैं?"
					: "Total kitne beds available hain?",
			],
		};
	}

	// Handler: CHECKOUT_OR_EXIT (Guidance only)
	if (intent.type === "CHECKOUT_OR_EXIT") {
		let spokenAnswer = "";
		if (lang === "hi") {
			spokenAnswer =
				"रेजिडेंट चेकआउट और डिपॉज़िट सेटलमेंट के लिए Dashboard के Residents सेक्शन से चेकआउट प्रोसेस करें। क्या आपको खाली रूम्स देखने हैं?";
		} else if (lang === "gu") {
			spokenAnswer =
				"રેસિડેન્ટ ચેકઆઉટ અને ડિપોઝિટ સેટલમેન્ટ માટે Residents સેક્શનમાંથી પ્રક્રિયા કરો. શું તમારે ખાલી રૂમ જોવા છે?";
		} else if (lang === "en") {
			spokenAnswer =
				"For resident checkout and deposit refunds, please process checkout from the Residents section in your Dashboard. Would you like to check vacant rooms?";
		} else {
			spokenAnswer =
				"Resident checkout aur deposit settlement ke liye Dashboard ke Residents section se checkout process karein. Kya aapko khali rooms dekhne hain?";
		}

		return {
			success: true,
			intent: intent.type,
			recognizedQuery: intent.originalQuery,
			spokenAnswer,
			property: activeProperty,
			metrics,
			vacantRooms: [], // Guidance only: no room cards
			suggestions: [
				lang === "hi" ? "कौन से रूम खाली हैं?" : "Kaunse room khali hain?",
				lang === "hi"
					? "कुल कितने बेड्स खाली हैं?"
					: "Total kitne beds available hain?",
			],
		};
	}

	// Handler: ROOM_CREATION_GUIDANCE (Guidance only)
	if (intent.type === "ROOM_CREATION_GUIDANCE") {
		let spokenAnswer = "";
		if (lang === "hi") {
			spokenAnswer =
				"अभी मैं आवाज़ से नया रूम या बेड सीधे ऐड नहीं कर सकता। आप Dashboard के Rooms & Beds सेक्शन (/user/rooms) में जाकर 'Add Room' से नया एसी या नॉन-एसी रूम जोड़ सकते हैं। क्या मैं पहले मौजूदा रूम्स की लिस्ट दिखाऊँ?";
		} else if (lang === "gu") {
			spokenAnswer =
				"હાલમાં હું અવાજ દ્વારા સીધા નવો રૂમ ઉમેરી શકતો નથી. તમે Dashboard ના Rooms સેક્શનમાં જઈને 'Add Room' દ્વારા નવો રૂમ ઉમેરી શકો છો. શું પહેલા ઉપલબ્ધ રૂમ બતાવું?";
		} else if (lang === "en") {
			spokenAnswer =
				"Currently, I cannot add or create rooms directly via voice. You can navigate to the Rooms & Beds section in your dashboard (/user/rooms) to add a new room. Shall I check vacant rooms first?";
		} else {
			spokenAnswer =
				"Abhi main voice se directly naya room add nahi kar sakta. Aap Dashboard ke Rooms section (/user/rooms) mein jaakar 'Add Room' button use kar sakte hain. Pehle available rooms check kar doon?";
		}

		return {
			success: true,
			intent: intent.type,
			recognizedQuery: intent.originalQuery,
			spokenAnswer,
			property: activeProperty,
			metrics,
			vacantRooms: [], // Guidance only: no room cards
			suggestions: [
				lang === "hi" ? "कौन से रूम खाली हैं?" : "Kaunse room khali hain?",
				lang === "hi"
					? "कुल कितने बेड्स खाली हैं?"
					: "Total kitne beds available hain?",
			],
		};
	}

	// Handler: PAYMENT_HISTORY_OR_DUES (Database Grounded Ledger & Resident Dues)
	if (intent.type === "PAYMENT_HISTORY_OR_DUES") {
		// Query all active residents for this property with their rooms, beds, and rent charges
		const activeResidents = await prisma.resident.findMany({
			where: {
				propertyId: activeProperty.id,
				status: "ACTIVE",
			},
			include: {
				room: { select: { roomNumber: true } },
				bed: { select: { bedNumber: true } },
				rentCharges: {
					include: {
						payments: { select: { amount: true } },
					},
				},
			},
		});

		// Check if user is asking about a specific person (e.g. "Rahul", "Ramesh", etc.)
		const lowerQuery = intent.originalQuery.toLowerCase();
		const matchedResident = activeResidents.find((r) =>
			lowerQuery.includes(r.name.toLowerCase().trim())
		);

		let spokenAnswer = "";

		if (matchedResident) {
			// Specific resident query!
			const totalCharged = matchedResident.rentCharges.reduce(
				(sum, rc) => sum + rc.amount,
				0
			);
			const totalPaid = matchedResident.rentCharges.reduce(
				(sum, rc) => sum + rc.payments.reduce((pSum, p) => pSum + p.amount, 0),
				0
			);
			const pendingDues = totalCharged - totalPaid;
			const rentStr = formatINR(matchedResident.monthlyRent);
			const pendingStr = formatINR(Math.max(0, pendingDues));
			const roomNo = matchedResident.room.roomNumber;
			const bedNo = matchedResident.bed.bedNumber;

			if (pendingDues > 0) {
				if (lang === "hi") {
					spokenAnswer = `${matchedResident.name} Room ${roomNo} (Bed #${bedNo}) में रहते हैं। उनका मासिक किराया ${rentStr} है और फिलहाल ${pendingStr} बकाया (Pending) है।`;
				} else if (lang === "gu") {
					spokenAnswer = `${matchedResident.name} Room ${roomNo} (Bed #${bedNo}) માં રહે છે. તેમનું માસિક ભાડું ${rentStr} છે અને હાલમાં ${pendingStr} બાકી છે.`;
				} else if (lang === "en") {
					spokenAnswer = `${matchedResident.name} stays in Room ${roomNo} (Bed #${bedNo}). Monthly rent is ${rentStr} with ${pendingStr} currently pending.`;
				} else {
					spokenAnswer = `${matchedResident.name} Room ${roomNo} (Bed #${bedNo}) mein rehte hain. Unka monthly rent ${rentStr} hai aur filhal ${pendingStr} pending hai.`;
				}
			} else {
				if (lang === "hi") {
					spokenAnswer = `${matchedResident.name} Room ${roomNo} (Bed #${bedNo}) में रहते हैं। उनका मासिक किराया ${rentStr} है और उनका किराया पूरी तरह चुकता (Paid) है।`;
				} else if (lang === "gu") {
					spokenAnswer = `${matchedResident.name} Room ${roomNo} (Bed #${bedNo}) માં રહે છે. તેમનું ભાડું ક્લિયર છે.`;
				} else if (lang === "en") {
					spokenAnswer = `${matchedResident.name} stays in Room ${roomNo} (Bed #${bedNo}). Their monthly rent is ${rentStr} and is fully paid.`;
				} else {
					spokenAnswer = `${matchedResident.name} Room ${roomNo} (Bed #${bedNo}) mein rehte hain. Unka rent ${rentStr} poora paid hai, koi dues nahi hain.`;
				}
			}
		} else {
			// General inquiry: "Kiska payment baki hai?", "Pending dues kiska hai?"
			const residentsWithDues = activeResidents
				.map((res) => {
					const totalCharged = res.rentCharges.reduce(
						(sum, rc) => sum + rc.amount,
						0
					);
					const totalPaid = res.rentCharges.reduce(
						(sum, rc) =>
							sum + rc.payments.reduce((pSum, p) => pSum + p.amount, 0),
						0
					);
					const pending = totalCharged - totalPaid;
					return {
						name: res.name,
						roomNumber: res.room.roomNumber,
						bedNumber: res.bed.bedNumber,
						pending,
					};
				})
				.filter((r) => r.pending > 0);

			if (residentsWithDues.length > 0) {
				const totalPendingSum = residentsWithDues.reduce(
					(s, r) => s + r.pending,
					0
				);
				const formattedTotal = formatINR(totalPendingSum);
				const duesBreakdown = residentsWithDues
					.slice(0, 4)
					.map(
						(r) => `${r.name} (Room ${r.roomNumber}: ${formatINR(r.pending)})`
					)
					.join(", ");
				const extraCount =
					residentsWithDues.length > 4
						? ` aur ${residentsWithDues.length - 4} anya`
						: "";

				if (lang === "hi") {
					spokenAnswer = `आपके पीजी '${activeProperty.name}' में ${residentsWithDues.length} रेजिडेंट्स का किराया बाकी है: ${duesBreakdown}${extraCount}। कुल पेंडिंग बकाया ${formattedTotal} है।`;
				} else if (lang === "gu") {
					spokenAnswer = `તમારા પીજી '${activeProperty.name}' માં ${residentsWithDues.length} રેસિડેન્ટ્સનું ભાડું બાકી છે: ${duesBreakdown}। કુલ બાકી રકમ ${formattedTotal} છે.`;
				} else if (lang === "en") {
					spokenAnswer = `In your PG '${activeProperty.name}', ${residentsWithDues.length} resident(s) have pending rent: ${duesBreakdown}. Total pending amount is ${formattedTotal}.`;
				} else {
					spokenAnswer = `Aapke PG '${activeProperty.name}' mein ${residentsWithDues.length} residents ka rent baki hai: ${duesBreakdown}${extraCount}. Kul pending dues ${formattedTotal} hai.`;
				}
			} else {
				if (lang === "hi") {
					spokenAnswer = `बधाई हो! आपके पीजी '${activeProperty.name}' में किसी भी रेजिडेंट का किराया बाकी नहीं है, सबका पेमेंट पूरी तरह क्लियर है।`;
				} else if (lang === "gu") {
					spokenAnswer = `તમારા પીજી '${activeProperty.name}' માં બધા રેસિડેન્ટ્સનું પેમેન્ટ ક્લિયર છે, કોઈનું ભાડું બાકી નથી.`;
				} else if (lang === "en") {
					spokenAnswer = `All active residents in your PG '${activeProperty.name}' have cleared their dues; there is no pending rent.`;
				} else {
					spokenAnswer = `Aapke PG '${activeProperty.name}' mein sabhi residents ka payment clear hai, kisi ka rent baki nahi hai.`;
				}
			}
		}

		return {
			success: true,
			intent: intent.type,
			recognizedQuery: intent.originalQuery,
			spokenAnswer,
			property: activeProperty,
			metrics,
			vacantRooms: [], // Ledger query: no room cards
			suggestions: [
				lang === "hi" ? "कौन से रूम खाली हैं?" : "Kaunse room khali hain?",
				lang === "hi"
					? "कुल कितने बेड्स खाली हैं?"
					: "Total kitne beds available hain?",
			],
		};
	}

	// Handler: PAYMENT_COLLECTION_GUIDANCE (Guidance only)
	if (intent.type === "PAYMENT_COLLECTION_GUIDANCE") {
		let spokenAnswer = "";
		if (lang === "hi") {
			spokenAnswer =
				"पेमेंट एंट्री और रसीद Dashboard के Payments लेज़र में रिकॉर्ड की जाती हैं। मैं रूम्स के रेंट रेट और उपलब्धता बता सकता हूँ।";
		} else {
			spokenAnswer =
				"Payment entry aur receipts Dashboard ke Payments ledger mein record ki jaati hain. Main rooms ke rent rate aur availability bata sakta hoon.";
		}

		return {
			success: true,
			intent: intent.type,
			recognizedQuery: intent.originalQuery,
			spokenAnswer,
			property: activeProperty,
			metrics,
			vacantRooms: [], // Guidance only: no room cards
			suggestions: [
				lang === "hi" ? "कौन से रूम खाली हैं?" : "Kaunse room khali hain?",
				lang === "hi"
					? "कुल कितने बेड्स खाली हैं?"
					: "Total kitne beds available hain?",
			],
		};
	}

	// Handler: RESIDENT_CHECKINS_OR_COUNT (Real DB counts)
	if (intent.type === "RESIDENT_CHECKINS_OR_COUNT") {
		const startOfToday = new Date();
		startOfToday.setHours(0, 0, 0, 0);
		const endOfToday = new Date();
		endOfToday.setHours(23, 59, 59, 999);

		const [activeResidentCount, todaysCheckinCount] = await Promise.all([
			prisma.resident.count({
				where: {
					propertyId: activeProperty.id,
					status: "ACTIVE",
				},
			}),
			prisma.resident.count({
				where: {
					propertyId: activeProperty.id,
					checkInDate: {
						gte: startOfToday,
						lte: endOfToday,
					},
				},
			}),
		]);

		const isCheckinInquiry = /(?:check-in|checkin|aaj|आज)/i.test(
			intent.originalQuery
		);

		let spokenAnswer = "";
		if (lang === "hi") {
			spokenAnswer = isCheckinInquiry
				? `आपके पीजी '${activeProperty.name}' में आज ${todaysCheckinCount} रेजिडेंट(्स) ने चेक-इन किया है। कुल एक्टिव रेजिडेंट्स ${activeResidentCount} हैं।`
				: `आपके पीजी '${activeProperty.name}' में कुल ${activeResidentCount} एक्टिव रेजिडेंट्स रह रहे हैं। आज ${todaysCheckinCount} रेजिडेंट(्स) ने चेक-इन किया है।`;
		} else if (lang === "gu") {
			spokenAnswer = isCheckinInquiry
				? `તમારા પીજી '${activeProperty.name}' માં આજે ${todaysCheckinCount} રેસિડેન્ટે ચેક-ઇન કર્યું છે. કુલ એક્ટિવ રેસિડેન્ટ ${activeResidentCount} છે.`
				: `તમારા પીજી '${activeProperty.name}' માં કુલ ${activeResidentCount} એક્ટિવ રેસિડેન્ટ રહે છે. આજે ${todaysCheckinCount} રેસિડેન્ટે ચેક-ઇન કર્યું છે.`;
		} else if (lang === "en") {
			spokenAnswer = isCheckinInquiry
				? `In your PG '${activeProperty.name}', ${todaysCheckinCount} resident(s) checked in today. There are ${activeResidentCount} active resident(s) in total.`
				: `Your PG '${activeProperty.name}' has ${activeResidentCount} active resident(s). Today, ${todaysCheckinCount} resident(s) checked in.`;
		} else {
			spokenAnswer = isCheckinInquiry
				? `Aapke PG '${activeProperty.name}' mein aaj ${todaysCheckinCount} resident(s) ne check-in kiya hai. Kul active residents ${activeResidentCount} hain.`
				: `Aapke PG '${activeProperty.name}' mein kul ${activeResidentCount} active residents reh rahe hain. Aaj ${todaysCheckinCount} resident(s) ne check-in kiya hai.`;
		}

		return {
			success: true,
			intent: intent.type,
			recognizedQuery: intent.originalQuery,
			spokenAnswer,
			property: activeProperty,
			metrics,
			vacantRooms: [], // Guidance/count only: no room cards
			suggestions: [
				lang === "hi" ? "कौन से रूम खाली हैं?" : "Kaunse room khali hain?",
				lang === "hi"
					? "कुल कितने बेड्स खाली हैं?"
					: "Total kitne beds available hain?",
			],
		};
	}

	// Handler: SIMPLIFIED_EXPLANATION
	if (intent.type === "SIMPLIFIED_EXPLANATION") {
		let spokenAnswer = "";
		if (lang === "hi") {
			spokenAnswer = `सीधी बात: आपके पीजी '${activeProperty.name}' में कुल ${availableBeds} बेड्स खाली हैं (${vacancyList.length} कमरों में)। कुल ${rooms.length} रूम्स हैं। आप किसी भी रूम का नंबर बोलकर स्टेटस या किराया पूछ सकते हैं, जैसे 'Room 1'।`;
		} else {
			spokenAnswer = `Seedhi baat: Aapke PG '${activeProperty.name}' mein kul ${availableBeds} beds khali hain (${vacancyList.length} rooms mein). Total ${rooms.length} rooms hain. Aap mujhse kisi bhi room ka number bolkar status ya rent poochh sakte hain, jaise 'Room 1'.`;
		}

		return {
			success: true,
			intent: intent.type,
			recognizedQuery: intent.originalQuery,
			spokenAnswer,
			property: activeProperty,
			metrics,
			vacantRooms: [], // Guidance only: no room cards
			suggestions: [
				lang === "hi" ? "कौन से रूम खाली हैं?" : "Kaunse room khali hain?",
				lang === "hi"
					? "कुल कितने बेड्स खाली हैं?"
					: "Total kitne beds available hain?",
			],
		};
	}

	// Handler: AMENITIES_OR_DEPOSITS (Unsupported Data)
	if (intent.type === "AMENITIES_OR_DEPOSITS") {
		const attr = intent.unsupportedAttribute || "ye suvidha";
		let spokenAnswer = "";
		if (lang === "hi") {
			spokenAnswer = `'${attr}' की जानकारी रूम डेटाबेस में स्टोर नहीं होती। मैं रूम की उपलब्धता, बेड्स की संख्या, शेयरिंग टाइप, एसी और किराया बता सकता हूँ।`;
		} else {
			spokenAnswer = `'${attr}' ki jaankari room database mein store nahi hoti. Main room vacancy, bed count, sharing type, AC aur rent rate bata sakta hoon.`;
		}

		return {
			success: true,
			intent: intent.type,
			recognizedQuery: intent.originalQuery,
			spokenAnswer,
			property: activeProperty,
			metrics,
			vacantRooms: [],
			suggestions: [
				lang === "hi" ? "कौन से रूम खाली हैं?" : "Kaunse room khali hain?",
				lang === "hi"
					? "कोई एसी वाला रूम खाली है?"
					: "Koi AC wala room khali hai?",
			],
		};
	}

	// Handler: SPECIFIC_ROOM_BEDS
	if (intent.type === "SPECIFIC_ROOM_BEDS" && intent.roomNumber) {
		const targetRoomNumber = intent.roomNumber;
		const targetRoom = rooms.find(
			(r) => r.roomNumber.toUpperCase() === targetRoomNumber
		);

		if (!targetRoom) {
			let notFoundAnswer = "";
			if (lang === "hi") {
				notFoundAnswer = `आपके पीजी '${activeProperty.name}' में Room ${targetRoomNumber} नहीं मिला। कृपया सही रूम नंबर चेक करें।`;
			} else if (lang === "gu") {
				notFoundAnswer = `તમારા પીજી '${activeProperty.name}' માં Room ${targetRoomNumber} મળ્યો નથી. કૃપા કરીને સાચો રૂમ નંબર ચકાસો.`;
			} else if (lang === "en") {
				notFoundAnswer = `Room ${targetRoomNumber} was not found in your PG '${activeProperty.name}'. Please check the room number.`;
			} else {
				notFoundAnswer = `Aapke PG '${activeProperty.name}' mein Room ${targetRoomNumber} nahi mila. Kripya sahi room number check karein.`;
			}

			return {
				success: true,
				intent: intent.type,
				recognizedQuery: intent.originalQuery,
				spokenAnswer: notFoundAnswer,
				property: activeProperty,
				metrics,
				vacantRooms: [], // No vacant rooms list when room is not found
				queriedRoom: null,
				suggestions: vacancyList
					.slice(0, 3)
					.map((v) =>
						lang === "hi"
							? `Room ${v.roomNumber} स्टेटस`
							: `Room ${v.roomNumber} status`
					),
			};
		}

		const availableInTarget = targetRoom.beds.filter(
			(b) => b.status === "AVAILABLE"
		);
		const targetDetail: RoomVacancyDetail = {
			roomId: targetRoom.id,
			roomNumber: targetRoom.roomNumber,
			floor: targetRoom.floor,
			sharing: targetRoom.sharing,
			acType: targetRoom.acType,
			rentPerBed: targetRoom.rentPerBed,
			totalBeds: targetRoom.beds.length,
			availableBedCount: availableInTarget.length,
			availableBedNumbers: availableInTarget.map((b) => b.bedNumber),
		};

		let spokenAnswer = "";
		if (intent.specificQueryFocus === "UNSUPPORTED") {
			if (lang === "hi") {
				spokenAnswer = `Room ${targetRoom.roomNumber} के बारे में '${
					intent.unsupportedAttribute || "इस सुविधा"
				}' की जानकारी डेटाबेस में स्टोर नहीं होती। फ़िलहाल आप रूम उपलब्धता, बेड काउंट, शेयरिंग टाइप, एसी स्टेटस और किराया पूछ सकते हैं।`;
			} else if (lang === "gu") {
				spokenAnswer = `Room ${targetRoom.roomNumber} માટે '${
					intent.unsupportedAttribute || "આ સુવિધા"
				}' ની માહિતી સ્ટોર થતી નથી. તમે રૂમ ઉપલબ્ધતા, બેડ, એસી અને ભાડું પૂછી શકો છો.`;
			} else if (lang === "en") {
				spokenAnswer = `Information about '${
					intent.unsupportedAttribute || "this feature"
				}' for Room ${targetRoom.roomNumber} is not stored in the database. You can check room vacancy, bed count, sharing, AC status, and rent.`;
			} else {
				spokenAnswer = `Room ${targetRoom.roomNumber} ke baare mein '${
					intent.unsupportedAttribute || "is feature"
				}' ki jaankari database mein store nahi hoti. Filhal aap room availability, bed count, sharing type, AC status aur rent poochh sakte hain.`;
			}
		} else if (intent.specificQueryFocus === "RENT") {
			const formattedRent = targetRoom.rentPerBed
				? formatINR(targetRoom.rentPerBed)
				: null;
			if (lang === "hi") {
				spokenAnswer = formattedRent
					? `Room ${targetRoom.roomNumber} का मासिक किराया ${formattedRent} प्रति बेड है।`
					: `Room ${targetRoom.roomNumber} का किराया सेट नहीं है।`;
			} else if (lang === "gu") {
				spokenAnswer = formattedRent
					? `Room ${targetRoom.roomNumber} નું માસિક ભાડું ${formattedRent} પ્રતિ બેડ છે.`
					: `Room ${targetRoom.roomNumber} નું ભાડું સેટ નથી.`;
			} else if (lang === "en") {
				spokenAnswer = formattedRent
					? `The monthly rent for Room ${targetRoom.roomNumber} is ${formattedRent} per bed.`
					: `Rent is not set for Room ${targetRoom.roomNumber}.`;
			} else {
				spokenAnswer = formattedRent
					? `Room ${targetRoom.roomNumber} ka monthly rent ${formattedRent} per bed hai.`
					: `Room ${targetRoom.roomNumber} ka rent set nahi hai.`;
			}
		} else if (intent.specificQueryFocus === "AC") {
			const isAC = targetRoom.acType === "AC";
			if (lang === "hi") {
				spokenAnswer = `Room ${targetRoom.roomNumber} ${
					isAC ? "एसी (AC) रूम है।" : "नॉन-एसी (Non-AC) रूम है।"
				}`;
			} else if (lang === "gu") {
				spokenAnswer = `Room ${targetRoom.roomNumber} ${
					isAC ? "એસી (AC) રૂમ છે." : "નોન-એસી (Non-AC) રૂમ છે."
				}`;
			} else if (lang === "en") {
				spokenAnswer = `Room ${targetRoom.roomNumber} is an ${
					isAC ? "AC" : "Non-AC"
				} room.`;
			} else {
				spokenAnswer = `Room ${targetRoom.roomNumber} ${
					isAC ? "AC room hai." : "Non-AC room hai."
				}`;
			}
		} else if (intent.specificQueryFocus === "SHARING") {
			if (lang === "hi") {
				spokenAnswer = `Room ${targetRoom.roomNumber} ${targetRoom.sharing} शेयरिंग रूम है।`;
			} else if (lang === "gu") {
				spokenAnswer = `Room ${targetRoom.roomNumber} ${targetRoom.sharing} શેરિંગ રૂમ છે.`;
			} else if (lang === "en") {
				spokenAnswer = `Room ${targetRoom.roomNumber} is a ${targetRoom.sharing} sharing room.`;
			} else {
				spokenAnswer = `Room ${targetRoom.roomNumber} ${targetRoom.sharing} Sharing room hai.`;
			}
		} else if (availableInTarget.length > 0) {
			const bedNumsStr = availableInTarget
				.map((b) => `Bed #${b.bedNumber}`)
				.join(", ");
			const formattedRent = targetRoom.rentPerBed
				? formatINR(targetRoom.rentPerBed)
				: null;
			if (lang === "hi") {
				const rentInfo = formattedRent
					? ` इसका किराया ${formattedRent} प्रति बेड है।`
					: "";
				spokenAnswer = `Room ${targetRoom.roomNumber} (${targetRoom.sharing} Sharing, ${targetRoom.acType}) में ${availableInTarget.length} बेड उपलब्ध हैं: ${bedNumsStr}।${rentInfo}`;
			} else if (lang === "gu") {
				const rentInfo = formattedRent
					? ` તેનું ભાડું ${formattedRent} પ્રતિ બેડ છે.`
					: "";
				spokenAnswer = `Room ${targetRoom.roomNumber} (${targetRoom.sharing} Sharing, ${targetRoom.acType}) માં ${availableInTarget.length} બેડ ઉપલબ્ધ છે: ${bedNumsStr}.${rentInfo}`;
			} else if (lang === "en") {
				const rentInfo = formattedRent
					? ` Rent is ${formattedRent} per bed.`
					: "";
				spokenAnswer = `Room ${targetRoom.roomNumber} (${targetRoom.sharing} Sharing, ${targetRoom.acType}) has ${availableInTarget.length} bed(s) available: ${bedNumsStr}.${rentInfo}`;
			} else {
				const rentInfo = formattedRent
					? ` Iska rent ${formattedRent} per bed hai.`
					: "";
				spokenAnswer = `Room ${targetRoom.roomNumber} (${targetRoom.sharing} Sharing, ${targetRoom.acType}) mein ${availableInTarget.length} bed available hain: ${bedNumsStr}.${rentInfo}`;
			}
		} else {
			if (lang === "hi") {
				spokenAnswer = `Room ${targetRoom.roomNumber} (${targetRoom.sharing} Sharing) में फ़िलहाल कोई बेड खाली नहीं है। सभी ${targetRoom.beds.length} बेड्स भरे हुए हैं।`;
			} else if (lang === "gu") {
				spokenAnswer = `Room ${targetRoom.roomNumber} (${targetRoom.sharing} Sharing) માં હાલમાં કોઈ બેડ ખાલી નથી. બધા ${targetRoom.beds.length} બેડ ભરેલા છે.`;
			} else if (lang === "en") {
				spokenAnswer = `Room ${targetRoom.roomNumber} (${targetRoom.sharing} Sharing) currently has no vacant beds. All ${targetRoom.beds.length} beds are occupied.`;
			} else {
				spokenAnswer = `Room ${targetRoom.roomNumber} (${targetRoom.sharing} Sharing) mein filhal koi bed khali nahi hai. Sabhi ${targetRoom.beds.length} beds occupied hain.`;
			}
		}

		return {
			success: true,
			intent: intent.type,
			recognizedQuery: intent.originalQuery,
			spokenAnswer,
			property: activeProperty,
			metrics,
			vacantRooms: [], // Card policy: specific room inquiry sets queriedRoom only, vacantRooms is []!
			queriedRoom: targetDetail,
			context: {
				lastQueriedRoomNumber: targetRoom.roomNumber,
				lastIntent: intent.type,
				lastAttribute: intent.specificQueryFocus,
				activePropertyId: activeProperty.id,
				timestamp: Date.now(),
			},
			suggestions: [
				lang === "hi"
					? `Room ${targetRoom.roomNumber} का किराया कितना है?`
					: `Room ${targetRoom.roomNumber} ka rent kitna hai?`,
				lang === "hi" ? "और एसी?" : "Aur AC?",
				lang === "hi" ? "कौन से रूम खाली हैं?" : "Kaunse room khali hain?",
			],
		};
	}

	// Handler: AVAILABLE_BEDS
	if (intent.type === "AVAILABLE_BEDS") {
		let spokenAnswer = "";
		if (availableBeds > 0) {
			if (lang === "hi") {
				spokenAnswer = `आपके पीजी '${activeProperty.name}' में कुल ${availableBeds} बेड्स खाली हैं (${vacancyList.length} कमरों में)।`;
			} else if (lang === "gu") {
				spokenAnswer = `તમારા પીજી '${activeProperty.name}' માં કુલ ${availableBeds} બેડ ખાલી છે (${vacancyList.length} રૂમમાં).`;
			} else if (lang === "en") {
				spokenAnswer = `In your PG '${activeProperty.name}', a total of ${availableBeds} bed(s) are available (across ${vacancyList.length} room(s)).`;
			} else {
				spokenAnswer = `Aapke PG '${activeProperty.name}' mein kul ${availableBeds} beds khali hain (${vacancyList.length} rooms mein).`;
			}
		} else {
			if (lang === "hi") {
				spokenAnswer = `आपके पीजी '${activeProperty.name}' में फ़िलहाल कोई बेड खाली नहीं है। सभी ${totalBeds} बेड्स भरे हुए हैं।`;
			} else if (lang === "gu") {
				spokenAnswer = `તમારા પીજી '${activeProperty.name}' માં હાલમાં કોઈ બેડ ખાલી નથી. બધા ${totalBeds} બેડ ભરેલા છે.`;
			} else if (lang === "en") {
				spokenAnswer = `Currently, no beds are available in your PG '${activeProperty.name}'. All ${totalBeds} beds are occupied.`;
			} else {
				spokenAnswer = `Aapke PG '${activeProperty.name}' mein filhal koi bed khali nahi hai. Sabhi ${totalBeds} beds full hain.`;
			}
		}

		return {
			success: true,
			intent: intent.type,
			recognizedQuery: intent.originalQuery,
			spokenAnswer,
			property: activeProperty,
			metrics,
			vacantRooms: [], // AVAILABLE_BEDS is a pure bed count query, do NOT render room cards list
			context: {
				lastQueriedRoomNumber: null,
				activePropertyId: activeProperty.id,
				timestamp: Date.now(),
			},
			suggestions: [
				lang === "hi" ? "कौन से रूम खाली हैं?" : "Kaunse room khali hain?",
				...(vacancyList[0] ? [`Room ${vacancyList[0].roomNumber} status`] : []),
			],
		};
	}

	// Handler: AVAILABLE_ROOMS (Default Vacancy Report)
	if (intent.type === "AVAILABLE_ROOMS") {
		let spokenAnswer = "";
		if (vacancyList.length > 0) {
			const roomHighlights = vacancyList
				.slice(0, 4)
				.map((v) => `Room ${v.roomNumber} (${v.availableBedCount} beds)`)
				.join(", ");
			const extra =
				vacancyList.length > 4
					? lang === "hi"
						? ` और ${vacancyList.length - 4} अन्य रूम्स`
						: lang === "gu"
							? ` અને ${vacancyList.length - 4} અન્ય રૂમ`
							: lang === "en"
								? ` and ${vacancyList.length - 4} other room(s)`
								: ` aur ${vacancyList.length - 4} anya rooms`
					: "";

			if (lang === "hi") {
				spokenAnswer = `आपके पीजी '${activeProperty.name}' में ${vacancyList.length} कमरों में बेड्स खाली हैं: ${roomHighlights}${extra}। कुल ${availableBeds} बेड्स उपलब्ध हैं।`;
			} else if (lang === "gu") {
				spokenAnswer = `તમારા પીજી '${activeProperty.name}' માં ${vacancyList.length} રૂમમાં બેડ ખાલી છે: ${roomHighlights}${extra}. કુલ ${availableBeds} બેડ ઉપલબ્ધ છે.`;
			} else if (lang === "en") {
				spokenAnswer = `In your PG '${activeProperty.name}', ${vacancyList.length} room(s) have available beds: ${roomHighlights}${extra}. Total ${availableBeds} bed(s) available.`;
			} else {
				spokenAnswer = `Aapke PG '${activeProperty.name}' mein ${vacancyList.length} rooms mein beds khali hain: ${roomHighlights}${extra}. Kul ${availableBeds} beds available hain.`;
			}
		} else {
			if (lang === "hi") {
				spokenAnswer = `आपके पीजी '${activeProperty.name}' में फ़िलहाल कोई रूम खाली नहीं है। पूरा पीजी 100% भरा हुआ है।`;
			} else if (lang === "gu") {
				spokenAnswer = `તમારા પીજી '${activeProperty.name}' માં હાલમાં કોઈ રૂમ ખાલી નથી. આખું પીજી 100% ભરેલું છે.`;
			} else if (lang === "en") {
				spokenAnswer = `Currently, no rooms are available in your PG '${activeProperty.name}'. The PG is 100% occupied.`;
			} else {
				spokenAnswer = `Aapke PG '${activeProperty.name}' mein filhal koi room khali nahi hai. Pura PG 100% occupied hai.`;
			}
		}

		return {
			success: true,
			intent: intent.type,
			recognizedQuery: intent.originalQuery,
			spokenAnswer,
			property: activeProperty,
			metrics,
			vacantRooms: vacancyList,
			context: {
				lastQueriedRoomNumber: null,
				activePropertyId: activeProperty.id,
				timestamp: Date.now(),
			},
			suggestions: [
				lang === "hi"
					? "कुल कितने बेड्स खाली हैं?"
					: "Total kitne beds available hain?",
				lang === "hi"
					? "कोई एसी वाला रूम खाली है?"
					: "Koi AC wala room khali hai?",
				...(vacancyList[0] ? [`Room ${vacancyList[0].roomNumber} status`] : []),
			],
		};
	}

	// Handler: CLARIFICATION_NEEDED or AMBIGUOUS_OR_UNSUPPORTED
	const defaultRoomNo = rooms[0]?.roomNumber || "1";
	let spokenAnswer = "";
	if (intent.type === "CLARIFICATION_NEEDED") {
		if (lang === "hi") {
			spokenAnswer =
				"आप किस रूम के बारे में पूछ रहे हैं? कृपया रूम नंबर बताएं, जैसे 'Room 1'।";
		} else if (lang === "gu") {
			spokenAnswer =
				"તમે કયા રૂમ વિશે પૂછી રહ્યા છો? કૃપા કરીને રૂમ નંબર જણાવો, જેમ કે 'Room 1'.";
		} else if (lang === "en") {
			spokenAnswer =
				"Which room are you asking about? Please specify the room number, such as 'Room 1'.";
		} else {
			spokenAnswer =
				"Aap kis room ke baare mein poochh rahe hain? Kripya room number batayein, jaise 'Room 1'.";
		}
	} else {
		if (lang === "hi") {
			spokenAnswer = `मैं आपके पीजी के खाली रूम्स, उपलब्ध बेड्स और रूम रेंट के सवाल बता सकता हूँ। कृपया पूछें: 'Kaunse room khali hain?' या 'Room ${defaultRoomNo} status'।`;
		} else if (lang === "gu") {
			spokenAnswer = `હું તમારા પીજીના ખાલી રૂમ, ઉપલબ્ધ બેડ અને રૂમ ભાડા અંગે જણાવી શકું છું. કૃપા કરીને પૂછો: 'Kaunse room khali hain?' અથવા 'Room ${defaultRoomNo} status'.`;
		} else if (lang === "en") {
			spokenAnswer = `I can help with vacant rooms, available beds, and room rent. Please ask: 'Which rooms are available?' or 'Room ${defaultRoomNo} status'.`;
		} else {
			spokenAnswer = `Main aapke PG ke khali rooms, available beds aur room rent ke sawal bata sakta hoon. Kripya poochhein: 'Kaunse room khali hain?' ya 'Room ${defaultRoomNo} status'.`;
		}
	}

	return {
		success: false,
		intent: intent.type,
		recognizedQuery: intent.originalQuery,
		spokenAnswer,
		property: activeProperty,
		metrics,
		vacantRooms: [], // No room cards on failure/clarification
		suggestions: [
			lang === "hi" ? "कौन से रूम खाली हैं?" : "Kaunse room khali hain?",
			lang === "hi"
				? "कुल कितने बेड्स खाली हैं?"
				: "Total kitne beds available hain?",
			lang === "hi"
				? `Room ${defaultRoomNo} स्टेटस`
				: `Room ${defaultRoomNo} status`,
		],
	};
}
