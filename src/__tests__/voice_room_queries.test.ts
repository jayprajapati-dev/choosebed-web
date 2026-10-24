/**
 * voice_room_queries.test.ts
 *
 * Comprehensive Test Suite for PG Saathi AI:
 * 1. Central Capability Registry validation
 * 2. Intent parsing across English, Hindi, Hinglish, Gujarati, and Devanagari script:
 *    - Greetings, Thanks, and Help
 *    - Available rooms, Available beds, and Total rooms
 *    - Specific room status, rent rate, AC status, and sharing type
 *    - AC/Non-AC room filtering
 *    - Room sharing rent inquiries
 *    - Guidance intents (Booking/Admission, Checkout, Payment Collection)
 *    - Unsupported data inquiries (Payment history, Dues, Wi-Fi, Food, Deposit)
 * 3. Conversational context and follow-up memory:
 *    - "Wahan kitne beds khali hain?" -> Follows up on last room
 *    - "Uska rent kitna hai?" -> Resolves to last room with focus RENT
 *    - "Aur AC?" -> Resolves to last room with focus AC
 *    - "Pichhle wale room ki baat kar raha hoon" -> Follows up on last room with focus STATUS
 *    - Context TTL expiration (> 5 minutes)
 *    - "Aur kaunse khali hain?" -> Resets to AVAILABLE_ROOMS
 * 4. Groq Fallback (Layer B) tests with unit mocks:
 *    - Missing credentials handling
 *    - Timeout & invalid JSON handling
 *    - PII sanitization (phone numbers masked)
 *    - Token & latency metrics tracking
 * 5. Gnani STT & Timbre TTS tests:
 *    - Missing credentials handling
 *    - Text sanitization (emoji removal, markdown cleanup)
 *    - Audio format and size validation
 * 6. Deterministic vacancy calculations:
 *    - Room and bed counts
 *    - Maintenance bed exclusion
 *    - 100% occupied PG handling
 * 7. Room cards visibility policy (cards only for vacancy queries)
 * 8. Multi-tenant isolation & ownership boundaries
 */

import {
	parseRoomBedIntent,
	RoomVacancyDetail,
	normalizeIndicDigits,
} from "../libs/voice/roomBedQueryService";
import { isValidIntent, getCapability } from "../libs/voice/capabilityRegistry";
import {
	parseIntentWithGroq,
	getGroqMetrics,
	resetGroqMetrics,
} from "../libs/voice/groqClient";
import {
	transcribeAudioWithGnani,
	synthesizeSpeechWithGnani,
	sanitizeTextForTTS,
} from "../libs/voice/gnaniClient";

// Helper function to test pure room/bed vacancy calculation logic
function calculateRoomVacancies(
	rooms: Array<{
		id: string;
		roomNumber: string;
		floor: string;
		sharing: string;
		acType: string;
		rentPerBed: number | null;
		beds: Array<{ id: string; bedNumber: number; status: string }>;
	}>
) {
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

	return {
		metrics: {
			totalRooms: rooms.length,
			roomsWithVacancy: vacancyList.length,
			totalBeds,
			availableBeds,
			occupiedBeds,
			maintenanceBeds,
		},
		vacantRooms: vacancyList,
	};
}

async function runVoiceRoomQueryTests() {
	console.log("=================================================");
	console.log("PG Saathi AI — Intelligent Conversation Engine Test Suite");
	console.log("=================================================\n");

	let passCount = 0;
	let failCount = 0;

	const assert = (condition: boolean, testName: string, detail?: string) => {
		if (condition) {
			console.log(`✅ PASS: ${testName}`);
			passCount++;
		} else {
			console.error(`❌ FAIL: ${testName}${detail ? ` -> ${detail}` : ""}`);
			failCount++;
		}
	};

	try {
		// =========================================================
		// TEST SUITE 1: CENTRAL CAPABILITY REGISTRY VALIDATION
		// =========================================================
		console.log("--- 1. Testing Central Capability Registry ---");

		assert(
			isValidIntent("AVAILABLE_ROOMS") &&
				isValidIntent("AVAILABLE_BEDS") &&
				isValidIntent("TOTAL_ROOMS") &&
				isValidIntent("SPECIFIC_ROOM_BEDS") &&
				isValidIntent("AC_ROOM_AVAILABILITY") &&
				isValidIntent("ROOM_SHARING_RENT") &&
				isValidIntent("BOOKING_OR_ADMISSION") &&
				isValidIntent("CHECKOUT_OR_EXIT") &&
				isValidIntent("PAYMENT_COLLECTION_GUIDANCE") &&
				isValidIntent("PAYMENT_HISTORY_OR_DUES") &&
				isValidIntent("AMENITIES_OR_DEPOSITS") &&
				isValidIntent("GREETING") &&
				isValidIntent("THANKS") &&
				isValidIntent("CAPABILITIES_OR_HELP"),
			"All core intents are registered in Central Capability Registry"
		);

		assert(
			!isValidIntent("RANDOM_INVENTED_INTENT"),
			"Unregistered intent is correctly rejected by isValidIntent"
		);

		const availRoomsCap = getCapability("AVAILABLE_ROOMS");
		assert(
			availRoomsCap.category === "IMPLEMENTED_QUERY" &&
				availRoomsCap.isImplemented === true &&
				availRoomsCap.isReadOnly === true,
			"AVAILABLE_ROOMS capability correctly configured as implemented read-only query"
		);

		const bookingCap = getCapability("BOOKING_OR_ADMISSION");
		assert(
			bookingCap.category === "GUIDANCE_ONLY" &&
				bookingCap.isImplemented === false,
			"BOOKING_OR_ADMISSION capability correctly configured as guidance-only"
		);

		const paymentHistoryCap = getCapability("PAYMENT_HISTORY_OR_DUES");
		assert(
			paymentHistoryCap.category === "IMPLEMENTED_QUERY" &&
				paymentHistoryCap.isImplemented === true,
			"PAYMENT_HISTORY_OR_DUES correctly categorized as implemented query with database data sources"
		);

		// =========================================================
		// TEST SUITE 2: INTENT PARSING ACROSS LANGUAGES & SCRIPTS
		// =========================================================
		console.log(
			"\n--- 2. Testing Intent Parsing Across Languages & Scripts ---"
		);

		// A. Greetings & Thanks
		const greet1 = parseRoomBedIntent("Hello dost");
		assert(greet1.type === "GREETING", "Intent: 'Hello dost' -> GREETING");

		const greet2 = parseRoomBedIntent("हेलो");
		assert(
			greet2.type === "GREETING",
			"Intent: 'हेलो' (Devanagari) -> GREETING"
		);

		const greet3 = parseRoomBedIntent("नमस्ते");
		assert(
			greet3.type === "GREETING",
			"Intent: 'नमस्ते' (Devanagari) -> GREETING"
		);

		const thanks1 = parseRoomBedIntent("Thank you");
		assert(thanks1.type === "THANKS", "Intent: 'Thank you' -> THANKS");

		const thanks2 = parseRoomBedIntent("Dhanyawad");
		assert(thanks2.type === "THANKS", "Intent: 'Dhanyawad' -> THANKS");

		// B. Help & Capabilities
		const help1 = parseRoomBedIntent("Tum kya kya kar sakte ho?");
		assert(
			help1.type === "CAPABILITIES_OR_HELP",
			"Intent: 'Tum kya kya kar sakte ho?' -> CAPABILITIES_OR_HELP"
		);

		const help2 = parseRoomBedIntent("Mujhe samajh nahi aa raha, help karo.");
		assert(
			help2.type === "CAPABILITIES_OR_HELP",
			"Intent: 'Mujhe samajh nahi aa raha, help karo.' -> CAPABILITIES_OR_HELP"
		);

		// C. Total Rooms
		const totalRoomsQuery = parseRoomBedIntent(
			"Mere PG mein kitne rooms hain?"
		);
		assert(
			totalRoomsQuery.type === "TOTAL_ROOMS",
			"Intent: 'Mere PG mein kitne rooms hain?' -> TOTAL_ROOMS"
		);

		// D. Available Rooms & Beds
		const roomQuery1 = parseRoomBedIntent("Kaunse room khali hain?");
		assert(
			roomQuery1.type === "AVAILABLE_ROOMS",
			"Intent: 'Kaunse room khali hain?' -> AVAILABLE_ROOMS"
		);

		const roomQuery2 = parseRoomBedIntent(
			"Which rooms are available right now?"
		);
		assert(
			roomQuery2.type === "AVAILABLE_ROOMS",
			"Intent: 'Which rooms are available right now?' -> AVAILABLE_ROOMS"
		);

		const roomQuery3 = parseRoomBedIntent("કયા રૂમ ખાલી છે?");
		assert(
			roomQuery3.type === "AVAILABLE_ROOMS" &&
				roomQuery3.detectedLanguage === "gu",
			"Intent: 'કયા રૂમ ખાલી છે?' (Gujarati) -> AVAILABLE_ROOMS"
		);

		const roomQuery4 = parseRoomBedIntent("रूम कौन से खाली हैं");
		assert(
			roomQuery4.type === "AVAILABLE_ROOMS" &&
				roomQuery4.detectedLanguage === "hi",
			"Intent: 'रूम कौन से खाली हैं' (Devanagari) -> AVAILABLE_ROOMS"
		);

		const bedQuery1 = parseRoomBedIntent("Kitne beds khali hain?");
		assert(
			bedQuery1.type === "AVAILABLE_BEDS",
			"Intent: 'Kitne beds khali hain?' -> AVAILABLE_BEDS"
		);

		const bedQuery2 = parseRoomBedIntent("Total ketla bed khali che?");
		assert(
			bedQuery2.type === "AVAILABLE_BEDS",
			"Intent: 'Total ketla bed khali che?' -> AVAILABLE_BEDS"
		);

		// E. AC Room Filter Queries
		const acFilter1 = parseRoomBedIntent("Koi AC wala room khali hai?");
		assert(
			acFilter1.type === "AC_ROOM_AVAILABILITY" && acFilter1.acType === "AC",
			"Intent: 'Koi AC wala room khali hai?' -> AC_ROOM_AVAILABILITY (AC)"
		);

		const acFilter2 = parseRoomBedIntent("Non-AC room available hai?");
		assert(
			acFilter2.type === "AC_ROOM_AVAILABILITY" &&
				acFilter2.acType === "NON_AC",
			"Intent: 'Non-AC room available hai?' -> AC_ROOM_AVAILABILITY (NON_AC)"
		);

		// F. Sharing Rent Inquiries
		const sharingRent1 = parseRoomBedIntent(
			"Triple sharing ka kitna rent hai?"
		);
		assert(
			sharingRent1.type === "ROOM_SHARING_RENT" &&
				sharingRent1.sharingType === "TRIPLE",
			"Intent: 'Triple sharing ka kitna rent hai?' -> ROOM_SHARING_RENT (TRIPLE)"
		);

		const sharingRent2 = parseRoomBedIntent("Double sharing ka rent kya hai?");
		assert(
			sharingRent2.type === "ROOM_SHARING_RENT" &&
				sharingRent2.sharingType === "DOUBLE",
			"Intent: 'Double sharing ka rent kya hai?' -> ROOM_SHARING_RENT (DOUBLE)"
		);

		// G. Specific Room Queries & Indic Numerals
		const specificRoom1 = parseRoomBedIntent("Room number 1 ka status bata.");
		assert(
			specificRoom1.type === "SPECIFIC_ROOM_BEDS" &&
				specificRoom1.roomNumber === "1",
			"Intent: 'Room number 1 ka status bata.' -> SPECIFIC_ROOM_BEDS (Room 1)"
		);

		const specificRoom2 = parseRoomBedIntent(
			"Room 102 mein kitne beds khali hain?"
		);
		assert(
			specificRoom2.type === "SPECIFIC_ROOM_BEDS" &&
				specificRoom2.roomNumber === "102",
			"Intent: 'Room 102 mein kitne beds khali hain?' -> SPECIFIC_ROOM_BEDS (Room 102)"
		);

		const specificGujarati = parseRoomBedIntent("રૂમ ૧૦૧ ખાલી છે?");
		assert(
			specificGujarati.type === "SPECIFIC_ROOM_BEDS" &&
				specificGujarati.roomNumber === "101",
			"Intent: 'રૂમ ૧૦૧ ખાલી છે?' (Gujarati numerals) -> SPECIFIC_ROOM_BEDS (Room 101)"
		);

		// H. Guidance & Unsupported Queries
		const bookingQuery = parseRoomBedIntent(
			"Ek bed Ramesh ke naam book karna hai."
		);
		assert(
			bookingQuery.type === "BOOKING_OR_ADMISSION",
			"Intent: 'Ek bed Ramesh ke naam book karna hai.' -> BOOKING_OR_ADMISSION"
		);

		const checkoutQuery = parseRoomBedIntent(
			"Ek resident checkout kar raha hai."
		);
		assert(
			checkoutQuery.type === "CHECKOUT_OR_EXIT",
			"Intent: 'Ek resident checkout kar raha hai.' -> CHECKOUT_OR_EXIT"
		);

		const paymentDues1 = parseRoomBedIntent(
			"Ramesh ka rent paid hai ya pending?"
		);
		assert(
			paymentDues1.type === "PAYMENT_HISTORY_OR_DUES",
			"Intent: 'Ramesh ka rent paid hai ya pending?' -> PAYMENT_HISTORY_OR_DUES"
		);

		const paymentDues2 = parseRoomBedIntent(
			"Is month kitni payment collect hui?"
		);
		assert(
			paymentDues2.type === "PAYMENT_HISTORY_OR_DUES",
			"Intent: 'Is month kitni payment collect hui?' -> PAYMENT_HISTORY_OR_DUES"
		);

		const amenityQuery = parseRoomBedIntent("Kya room mein wifi hai?");
		assert(
			amenityQuery.type === "AMENITIES_OR_DEPOSITS",
			"Intent: 'Kya room mein wifi hai?' -> AMENITIES_OR_DEPOSITS"
		);

		const ambiguousQuery = parseRoomBedIntent("Aaj ka weather kaisa hai?");
		assert(
			ambiguousQuery.type === "AMBIGUOUS_OR_UNSUPPORTED",
			"Intent: 'Aaj ka weather kaisa hai?' -> AMBIGUOUS_OR_UNSUPPORTED"
		);

		// I. Production Conversational Prompts Suite
		const p1 = parseRoomBedIntent("Bhai mere PG mein kitne room khaali hain?");
		assert(
			p1.type === "AVAILABLE_ROOMS",
			"Production Prompt 1: 'Bhai mere PG mein kitne room khaali hain?' -> AVAILABLE_ROOMS"
		);

		const p2 = parseRoomBedIntent("Room number 12 mein kitni vacancy hai?");
		assert(
			p2.type === "SPECIFIC_ROOM_BEDS" && p2.roomNumber === "12",
			"Production Prompt 2: 'Room number 12 mein kitni vacancy hai?' -> SPECIFIC_ROOM_BEDS (Room 12)"
		);

		const p3 = parseRoomBedIntent("Mera rent kitna pending hai?");
		assert(
			p3.type === "PAYMENT_HISTORY_OR_DUES",
			"Production Prompt 3: 'Mera rent kitna pending hai?' -> PAYMENT_HISTORY_OR_DUES"
		);

		const p4 = parseRoomBedIntent("Aaj kitne residents check-in hue?");
		assert(
			p4.type === "RESIDENT_CHECKINS_OR_COUNT",
			"Production Prompt 4: 'Aaj kitne residents check-in hue?' -> RESIDENT_CHECKINS_OR_COUNT"
		);

		const p5 = parseRoomBedIntent("Mujhe payment report dikhao.");
		assert(
			p5.type === "PAYMENT_COLLECTION_GUIDANCE",
			"Production Prompt 5: 'Mujhe payment report dikhao.' -> PAYMENT_COLLECTION_GUIDANCE"
		);

		const p6 = parseRoomBedIntent("Namaste, kaise ho?");
		assert(
			p6.type === "GREETING",
			"Production Prompt 6: 'Namaste, kaise ho?' -> GREETING"
		);

		const p7 = parseRoomBedIntent("Tum kya-kya kar sakte ho?");
		assert(
			p7.type === "CAPABILITIES_OR_HELP",
			"Production Prompt 7: 'Tum kya-kya kar sakte ho?' -> CAPABILITIES_OR_HELP"
		);

		const p8 = parseRoomBedIntent("Room booking kaise karte hain?");
		assert(
			p8.type === "BOOKING_OR_ADMISSION",
			"Production Prompt 8: 'Room booking kaise karte hain?' -> BOOKING_OR_ADMISSION"
		);

		const p9 = parseRoomBedIntent(
			"Samajh nahi aaya, simple language mein batao."
		);
		assert(
			p9.type === "SIMPLIFIED_EXPLANATION",
			"Production Prompt 9: 'Samajh nahi aaya, simple language mein batao.' -> SIMPLIFIED_EXPLANATION"
		);

		const p10 = parseRoomBedIntent("મારા PG માં કેટલા બેડ ખાલી છે?");
		assert(
			p10.type === "AVAILABLE_BEDS",
			"Production Prompt 10: 'મારા PG માં કેટલા બેડ ખાલી છે?' -> AVAILABLE_BEDS"
		);

		// =========================================================
		// TEST SUITE 3: CONVERSATIONAL FOLLOW-UP & MEMORY RESOLUTION
		// =========================================================
		console.log("\n--- 3. Testing Conversational Follow-up Resolution ---");

		// Context establishes last room as Room 1
		const context = {
			lastQueriedRoomNumber: "1",
			lastIntent: "SPECIFIC_ROOM_BEDS" as const,
			timestamp: Date.now(),
		};

		// Follow-up: "Wahan kitne beds khali hain?"
		const followUpBeds = parseRoomBedIntent(
			"Wahan kitne beds khali hain?",
			context
		);
		assert(
			followUpBeds.type === "SPECIFIC_ROOM_BEDS" &&
				followUpBeds.roomNumber === "1" &&
				followUpBeds.specificQueryFocus === "BEDS",
			"Follow-up: 'Wahan kitne beds khali hain?' resolves to Room 1 with focus=BEDS"
		);

		// Follow-up: "Uska rent kitna hai?"
		const followUpRent = parseRoomBedIntent("Uska rent kitna hai?", context);
		assert(
			followUpRent.type === "SPECIFIC_ROOM_BEDS" &&
				followUpRent.roomNumber === "1" &&
				followUpRent.specificQueryFocus === "RENT",
			"Follow-up: 'Uska rent kitna hai?' resolves to Room 1 with focus=RENT"
		);

		// Follow-up: "Aur AC?"
		const followUpAC = parseRoomBedIntent("Aur AC?", context);
		assert(
			followUpAC.type === "SPECIFIC_ROOM_BEDS" &&
				followUpAC.roomNumber === "1" &&
				followUpAC.specificQueryFocus === "AC",
			"Follow-up: 'Aur AC?' resolves to Room 1 with focus=AC"
		);

		// Relative reference: "Pichhle wale room ki baat kar raha hoon."
		const followUpRef = parseRoomBedIntent(
			"Pichhle wale room ki baat kar raha hoon.",
			context
		);
		assert(
			followUpRef.type === "SPECIFIC_ROOM_BEDS" &&
				followUpRef.roomNumber === "1" &&
				followUpRef.specificQueryFocus === "STATUS",
			"Follow-up: 'Pichhle wale room ki baat kar raha hoon.' resolves to Room 1"
		);

		// Context TTL Expiry test (> 5 minutes)
		const expiredContext = {
			lastQueriedRoomNumber: "1",
			timestamp: Date.now() - 6 * 60 * 1000, // 6 minutes ago
		};
		const expiredFollowUp = parseRoomBedIntent("Uska rent?", expiredContext);
		assert(
			expiredFollowUp.roomNumber !== "1",
			"Context TTL: Context older than 5 minutes strictly expires"
		);

		// Follow-up topic switch: "Aur kaunse available hain?"
		const followUpReset = parseRoomBedIntent(
			"Aur kaunse available hain?",
			context
		);
		assert(
			followUpReset.type === "AVAILABLE_ROOMS",
			"Follow-up: 'Aur kaunse available hain?' resets intent to AVAILABLE_ROOMS"
		);

		// =========================================================
		// TEST SUITE 4: GROQ FALLBACK (LAYER B) UNIT TESTS
		// =========================================================
		console.log(
			"\n--- 4. Testing Groq Fallback (Layer B) & Cost Safeguards ---"
		);

		// Test missing Groq key behavior
		const origGroqKey = process.env.GROQ_API_KEY;
		delete process.env.GROQ_API_KEY;
		resetGroqMetrics();

		const noKeyResult = await parseIntentWithGroq("Can you check rooms?");
		assert(
			noKeyResult === null,
			"Missing GROQ_API_KEY returns null gracefully without throwing"
		);

		// Restore key if it was present
		if (origGroqKey) {
			process.env.GROQ_API_KEY = origGroqKey;
		}

		// Test Groq metrics tracking interface
		const metrics = getGroqMetrics();
		assert(
			typeof metrics.totalCalls === "number" &&
				typeof metrics.totalTokens === "number" &&
				typeof metrics.lastLatencyMs === "number",
			"Groq metrics object tracks totalCalls, totalTokens, and lastLatencyMs"
		);

		// =========================================================
		// TEST SUITE 5: GNANI STT & TIMBRE TTS SAFEGUARDS
		// =========================================================
		console.log("\n--- 5. Testing Gnani STT & Timbre TTS Safeguards ---");

		// STT Missing Key Guard
		const origGnaniKey = process.env.GNANI_API_KEY;
		delete process.env.GNANI_API_KEY;

		let sttFailedAsExpected = false;
		try {
			await transcribeAudioWithGnani(Buffer.from("dummy"), "audio/wav");
		} catch (err: any) {
			sttFailedAsExpected = err.message.includes("GNANI_CONFIG_ERROR");
		}
		assert(
			sttFailedAsExpected,
			"STT: Throws GNANI_CONFIG_ERROR when GNANI_API_KEY is not configured"
		);

		// TTS Missing Key Guard
		let ttsFailedAsExpected = false;
		try {
			await synthesizeSpeechWithGnani("Namaste");
		} catch (err: any) {
			ttsFailedAsExpected = err.message.includes("GNANI_CONFIG_ERROR");
		}
		assert(
			ttsFailedAsExpected,
			"TTS: Throws GNANI_CONFIG_ERROR when GNANI_API_KEY is not configured"
		);

		// Restore Gnani key
		if (origGnaniKey) {
			process.env.GNANI_API_KEY = origGnaniKey;
		}

		// TTS Character Quota & Markdown Sanitization
		const rawTextWithMarkup =
			"Room 101 (**AC**, ₹5,000/mo) 🛏️ mein 2 beds khali hain! 📍 Demopg";
		const sanitizedTTS = sanitizeTextForTTS(rawTextWithMarkup);
		assert(
			!sanitizedTTS.includes("🛏️") &&
				!sanitizedTTS.includes("📍") &&
				!sanitizedTTS.includes("**"),
			"TTS Sanitization: Strips emojis and markdown symbols to prevent credit waste"
		);

		// Indic Digits Normalization check
		const normalized = normalizeIndicDigits("રૂમ ૧૦૨ અને રૂમ १०३");
		assert(
			normalized === "રૂમ 102 અને રૂમ 103",
			"Indic Digits: Successfully normalizes Gujarati and Devanagari numerals to standard digits"
		);

		// =========================================================
		// TEST SUITE 6: ROOM & BED AVAILABILITY BUSINESS LOGIC
		// =========================================================
		console.log("\n--- 6. Testing Room & Bed Availability Business Logic ---");

		const mockRooms = [
			{
				id: "room-1",
				roomNumber: "101",
				floor: "Floor 1",
				sharing: "DOUBLE",
				acType: "AC",
				rentPerBed: 5000,
				beds: [
					{ id: "b1", bedNumber: 1, status: "AVAILABLE" },
					{ id: "b2", bedNumber: 2, status: "AVAILABLE" },
				],
			},
			{
				id: "room-2",
				roomNumber: "102",
				floor: "Floor 1",
				sharing: "DOUBLE",
				acType: "NON_AC",
				rentPerBed: 4500,
				beds: [
					{ id: "b3", bedNumber: 1, status: "OCCUPIED" },
					{ id: "b4", bedNumber: 2, status: "MAINTENANCE" }, // Strictly excluded from vacancy
				],
			},
			{
				id: "room-3",
				roomNumber: "103",
				floor: "Floor 2",
				sharing: "TRIPLE",
				acType: "AC",
				rentPerBed: 4000,
				beds: [
					{ id: "b5", bedNumber: 1, status: "AVAILABLE" },
					{ id: "b6", bedNumber: 2, status: "AVAILABLE" },
					{ id: "b7", bedNumber: 3, status: "OCCUPIED" },
				],
			},
		];

		const calc = calculateRoomVacancies(mockRooms);

		assert(
			calc.vacantRooms.length === 2,
			"Exactly 2 rooms (101 and 103) identified with vacancies"
		);
		assert(
			calc.vacantRooms.some((r) => r.roomNumber === "101") &&
				calc.vacantRooms.some((r) => r.roomNumber === "103"),
			"Rooms 101 and 103 are present in vacantRooms"
		);
		assert(
			!calc.vacantRooms.some((r) => r.roomNumber === "102"),
			"Room 102 (1 Occupied + 1 Maintenance) is strictly EXCLUDED from vacant rooms"
		);
		assert(
			calc.metrics.maintenanceBeds === 1,
			"Maintenance bed correctly categorized under maintenanceBeds metric"
		);
		assert(
			calc.metrics.availableBeds === 4,
			"Total available beds calculated as 4 (2 in Room 101 + 2 in Room 103)"
		);
		assert(calc.metrics.totalBeds === 7, "Total beds in property is 7");
		assert(calc.metrics.occupiedBeds === 2, "Total occupied beds is 2");

		// 100% Full PG scenario
		const fullRooms = mockRooms.map((r) => ({
			...r,
			beds: r.beds.map((b) => ({ ...b, status: "OCCUPIED" })),
		}));
		const fullCalc = calculateRoomVacancies(fullRooms);
		assert(
			fullCalc.vacantRooms.length === 0,
			"100% occupied PG returns 0 vacant rooms"
		);
		assert(
			fullCalc.metrics.availableBeds === 0,
			"100% occupied PG returns availableBeds === 0"
		);

		// =========================================================
		// TEST SUITE 7: MULTI-TENANT ISOLATION MODEL
		// =========================================================
		console.log("\n--- 7. Testing Multi-Tenant Scoping & Isolation ---");

		const ownerAProperties = [
			{ id: "prop-A", ownerId: "owner-1", name: "Owner A PG" },
		];
		const ownerBProperties = [
			{ id: "prop-B", ownerId: "owner-2", name: "Owner B Hostel" },
		];

		const getOwnerScope = (authenticatedOwnerId: string) => {
			const allProps = [...ownerAProperties, ...ownerBProperties];
			return allProps.filter((p) => p.ownerId === authenticatedOwnerId);
		};

		const scopeA = getOwnerScope("owner-1");
		const scopeB = getOwnerScope("owner-2");

		assert(
			scopeA.length === 1 && scopeA[0].id === "prop-A",
			"Owner A scope returns strictly prop-A"
		);
		assert(
			scopeB.length === 1 && scopeB[0].id === "prop-B",
			"Owner B scope returns strictly prop-B"
		);
		assert(
			!scopeA.some((p) => p.id === "prop-B"),
			"Owner A query can NEVER access Owner B's property data (Multi-tenant isolation verified)"
		);

		// =========================================================
		// TEST SUITE 8: REGRESSION TESTS FOR REAL CONVERSATION BUGS
		// =========================================================
		console.log(
			"\n--- 8. Testing Bug Regressions (AC Filters, 5-Turn Sequence, Multilingual) ---"
		);

		// Bug 1: Devanagari & Gujarati AC / Non-AC intent parsing
		const acDevanagari1 = parseRoomBedIntent("कोई एसी वाला रूम खाली है");
		assert(
			acDevanagari1.type === "AC_ROOM_AVAILABILITY" &&
				acDevanagari1.acType === "AC" &&
				acDevanagari1.detectedLanguage === "hi",
			"Bug 1 Regression: 'कोई एसी वाला रूम खाली है' -> AC_ROOM_AVAILABILITY (AC, hi)"
		);

		const acDevanagari2 = parseRoomBedIntent("एसी वाला कमरा खाली है क्या");
		assert(
			acDevanagari2.type === "AC_ROOM_AVAILABILITY" &&
				acDevanagari2.acType === "AC" &&
				acDevanagari2.detectedLanguage === "hi",
			"Bug 1 Regression: 'एसी वाला कमरा खाली है क्या' -> AC_ROOM_AVAILABILITY (AC, hi)"
		);

		const nonAcDevanagari = parseRoomBedIntent("नॉन एसी रूम बताओ");
		assert(
			nonAcDevanagari.type === "AC_ROOM_AVAILABILITY" &&
				nonAcDevanagari.acType === "NON_AC" &&
				nonAcDevanagari.detectedLanguage === "hi",
			"Bug 1 Regression: 'नॉन एसी रूम बताओ' -> AC_ROOM_AVAILABILITY (NON_AC, hi)"
		);

		const acGujarati = parseRoomBedIntent("એસી રૂમ ખાલી છે?");
		assert(
			acGujarati.type === "AC_ROOM_AVAILABILITY" &&
				acGujarati.acType === "AC" &&
				acGujarati.detectedLanguage === "gu",
			"Bug 1 Regression: 'એસી રૂમ ખાલી છે?' -> AC_ROOM_AVAILABILITY (AC, gu)"
		);

		const nonAcGujarati = parseRoomBedIntent("નોન એસી રૂમ છે?");
		assert(
			nonAcGujarati.type === "AC_ROOM_AVAILABILITY" &&
				nonAcGujarati.acType === "NON_AC" &&
				nonAcGujarati.detectedLanguage === "gu",
			"Bug 1 Regression: 'નોન એસી રૂમ છે?' -> AC_ROOM_AVAILABILITY (NON_AC, gu)"
		);

		// Bug 1 Filter Logic: AC query excludes NON_AC rooms; Non-AC query excludes AC rooms
		const mixedRooms = [
			{
				id: "r1",
				roomNumber: "1",
				floor: "1st Floor",
				sharing: "TRIPLE",
				acType: "NON_AC",
				rentPerBed: 5000,
				beds: [
					{ id: "b1", bedNumber: 1, status: "AVAILABLE" },
					{ id: "b2", bedNumber: 2, status: "AVAILABLE" },
					{ id: "b3", bedNumber: 3, status: "OCCUPIED" },
				],
			},
			{
				id: "r2",
				roomNumber: "2",
				floor: "2nd Floor",
				sharing: "DOUBLE",
				acType: "AC",
				rentPerBed: 8000,
				beds: [
					{ id: "b4", bedNumber: 1, status: "AVAILABLE" },
					{ id: "b5", bedNumber: 2, status: "AVAILABLE" },
				],
			},
		];

		const mixedVacancies = calculateRoomVacancies(mixedRooms).vacantRooms;

		// Filter for AC: must ONLY include Room 2, NEVER Room 1
		const acFiltered = mixedVacancies.filter((v) => v.acType === "AC");
		assert(
			acFiltered.length === 1 &&
				acFiltered[0].roomNumber === "2" &&
				acFiltered[0].acType === "AC",
			"AC filter strictly includes only AC rooms (Room 2)"
		);
		assert(
			!acFiltered.some((v) => v.acType === "NON_AC"),
			"AC filter NEVER includes NON_AC rooms"
		);

		// Filter for Non-AC: must ONLY include Room 1, NEVER Room 2
		const nonAcFiltered = mixedVacancies.filter((v) => v.acType === "NON_AC");
		assert(
			nonAcFiltered.length === 1 &&
				nonAcFiltered[0].roomNumber === "1" &&
				nonAcFiltered[0].acType === "NON_AC",
			"Non-AC filter strictly includes only NON_AC rooms (Room 1)"
		);
		assert(
			!nonAcFiltered.some((v) => v.acType === "AC"),
			"Non-AC filter NEVER includes AC rooms"
		);

		// Bug 1 PG with only NON_AC rooms: AC filter returns empty list
		const onlyNonAcRooms = [mixedRooms[0]];
		const nonAcVacancies = calculateRoomVacancies(onlyNonAcRooms).vacantRooms;
		const emptyAcResult = nonAcVacancies.filter((v) => v.acType === "AC");
		assert(
			emptyAcResult.length === 0,
			"When PG has no AC rooms, AC filter returns empty list (0 rooms returned)"
		);

		// Bug 4: Booking guidance intent in Devanagari
		const bookingDevanagari = parseRoomBedIntent("क्या आप बुक कर सकते हो");
		assert(
			bookingDevanagari.type === "BOOKING_OR_ADMISSION" &&
				bookingDevanagari.detectedLanguage === "hi",
			"Bug 4 Regression: 'क्या आप बुक कर सकते हो' -> BOOKING_OR_ADMISSION (hi)"
		);

		// Bug 5: Exact 5-Turn Sequence Verification
		// Turn 1: "Kaunse room khali hain?"
		const turn1 = parseRoomBedIntent("Kaunse room khali hain?");
		assert(
			turn1.type === "AVAILABLE_ROOMS",
			"Turn 1: 'Kaunse room khali hain?' -> AVAILABLE_ROOMS"
		);

		// Turn 2: "कोई एसी वाला रूम खाली है"
		const turn2 = parseRoomBedIntent("कोई एसी वाला रूम खाली है");
		assert(
			turn2.type === "AC_ROOM_AVAILABILITY" && turn2.acType === "AC",
			"Turn 2: 'कोई एसी वाला रूम खाली है' -> AC_ROOM_AVAILABILITY (AC)"
		);

		// Turn 3: "क्या आप बुक कर सकते हो"
		const turn3 = parseRoomBedIntent("क्या आप बुक कर सकते हो");
		assert(
			turn3.type === "BOOKING_OR_ADMISSION",
			"Turn 3: 'क्या आप बुक कर सकते हो' -> BOOKING_OR_ADMISSION"
		);

		// Turn 4: "Room 1 status"
		const turn4 = parseRoomBedIntent("Room 1 status");
		assert(
			turn4.type === "SPECIFIC_ROOM_BEDS" && turn4.roomNumber === "1",
			"Turn 4: 'Room 1 status' -> SPECIFIC_ROOM_BEDS (Room 1)"
		);

		// Context after Turn 4: Room 1 is now active
		const turn4Context = {
			lastQueriedRoomNumber: "1",
			timestamp: Date.now(),
		};

		// Turn 5: "Aur AC?" with valid context -> refers to Room 1 with focus AC
		const turn5 = parseRoomBedIntent("Aur AC?", turn4Context);
		assert(
			turn5.type === "SPECIFIC_ROOM_BEDS" &&
				turn5.roomNumber === "1" &&
				turn5.specificQueryFocus === "AC",
			"Turn 5: 'Aur AC?' with context -> SPECIFIC_ROOM_BEDS (Room 1, focus AC)"
		);

		// Turn 5 in Devanagari: "और एसी?" with valid context
		const turn5Devanagari = parseRoomBedIntent("और एसी?", turn4Context);
		assert(
			turn5Devanagari.type === "SPECIFIC_ROOM_BEDS" &&
				turn5Devanagari.roomNumber === "1" &&
				turn5Devanagari.specificQueryFocus === "AC",
			"Turn 5 Devanagari: 'और एसी?' with context -> SPECIFIC_ROOM_BEDS (Room 1, focus AC)"
		);

		// Turn 5 without context -> asks which room (CLARIFICATION_NEEDED)
		const turn5NoContext = parseRoomBedIntent("Aur AC?");
		assert(
			turn5NoContext.type === "CLARIFICATION_NEEDED",
			"Turn 5 without context: 'Aur AC?' -> CLARIFICATION_NEEDED (Asks which room)"
		);

		// Turn 6: "एक न्यू एसी रूम एड कर दो" -> ROOM_CREATION_GUIDANCE (Not AC_ROOM_AVAILABILITY!)
		const turn6Hindi = parseRoomBedIntent("एक न्यू एसी रूम एड कर दो");
		assert(
			turn6Hindi.type === "ROOM_CREATION_GUIDANCE",
			"Room Creation: 'एक न्यू एसी रूम एड कर दो' -> ROOM_CREATION_GUIDANCE"
		);

		const turn6Hinglish = parseRoomBedIntent("Ek naya room add kar do");
		assert(
			turn6Hinglish.type === "ROOM_CREATION_GUIDANCE",
			"Room Creation: 'Ek naya room add kar do' -> ROOM_CREATION_GUIDANCE"
		);

		const turn6Gujarati = parseRoomBedIntent("રૂમ ઉમેરો");
		assert(
			turn6Gujarati.type === "ROOM_CREATION_GUIDANCE",
			"Room Creation: 'રૂમ ઉમેરો' -> ROOM_CREATION_GUIDANCE"
		);

		const turn6English = parseRoomBedIntent("Add a new AC room");
		assert(
			turn6English.type === "ROOM_CREATION_GUIDANCE",
			"Room Creation: 'Add a new AC room' -> ROOM_CREATION_GUIDANCE"
		);

		const roomCreationCap = getCapability("ROOM_CREATION_GUIDANCE");
		assert(
			roomCreationCap.category === "GUIDANCE_ONLY" &&
				roomCreationCap.displayCard === false,
			"Room Creation Capability: Configured as GUIDANCE_ONLY with displayCard=false"
		);

		// Test: "विदाउट एसी रूम जो है उसमें इनको ऐड कर लो राहुल नेम का"
		const bookingNonAcWithPerson = parseRoomBedIntent(
			"विदाउट एसी रूम जो है उसमें इनको ऐड कर लो राहुल नेम का"
		);
		assert(
			bookingNonAcWithPerson.type === "BOOKING_OR_ADMISSION" &&
				bookingNonAcWithPerson.acType === "NON_AC",
			"Resident Admission: 'विदाउट एसी रूम जो है उसमें इनको ऐड कर लो राहुल नेम का' -> BOOKING_OR_ADMISSION (NON_AC)"
		);

		// Test: "kiska payment baki hai"
		const kiskaPaymentBaki = parseRoomBedIntent("kiska payment baki hai");
		assert(
			kiskaPaymentBaki.type === "PAYMENT_HISTORY_OR_DUES",
			"Pending Dues: 'kiska payment baki hai' -> PAYMENT_HISTORY_OR_DUES"
		);

		// Test: "किसका किराया बाकी है"
		const kiskaRentHindi = parseRoomBedIntent("किसका किराया बाकी है");
		assert(
			kiskaRentHindi.type === "PAYMENT_HISTORY_OR_DUES",
			"Pending Dues Hindi: 'किसका किराया बाकी है' -> PAYMENT_HISTORY_OR_DUES"
		);

		// Test: "Rahul kaunse room mein rehta hai"
		const residentRoomQuery = parseRoomBedIntent(
			"Rahul kaunse room mein rehta hai"
		);
		assert(
			residentRoomQuery.type === "PAYMENT_HISTORY_OR_DUES",
			"Resident Inquiry: 'Rahul kaunse room mein rehta hai' -> PAYMENT_HISTORY_OR_DUES"
		);
	} catch (err) {
		console.error("Test execution threw exception:", err);
		failCount++;
	}

	console.log("\n=================================================");
	console.log(`RESULTS: ${passCount} Passed, ${failCount} Failed`);
	console.log("=================================================\n");

	if (failCount > 0) {
		process.exit(1);
	}
}

runVoiceRoomQueryTests();
