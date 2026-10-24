/**
 * capabilityRegistry.ts
 *
 * Central Capability Registry for PG Saathi AI.
 * Single source of truth describing all supported assistant capabilities:
 * - Intent name
 * - Supported user questions (examplePhrases)
 * - Required parameters (requiredEntities)
 * - Authorized data sources
 * - Whether an LLM is needed
 * - Whether TTS is appropriate
 * - Whether the UI should display a result card
 * - Whether the capability is read-only or performs an action
 * - Safe fallback response
 * - Suggested follow-up questions
 */

export type CapabilityCategory =
	"IMPLEMENTED_QUERY" | "GUIDANCE_ONLY" | "UNSUPPORTED_DATA" | "CONVERSATIONAL";

export type SupportedIntentType =
	| "AVAILABLE_ROOMS"
	| "AVAILABLE_BEDS"
	| "TOTAL_ROOMS"
	| "SPECIFIC_ROOM_BEDS"
	| "AC_ROOM_AVAILABILITY"
	| "ROOM_SHARING_RENT"
	| "RESIDENT_CHECKINS_OR_COUNT"
	| "BOOKING_OR_ADMISSION"
	| "CHECKOUT_OR_EXIT"
	| "ROOM_CREATION_GUIDANCE"
	| "PAYMENT_COLLECTION_GUIDANCE"
	| "PAYMENT_HISTORY_OR_DUES"
	| "AMENITIES_OR_DEPOSITS"
	| "GREETING"
	| "THANKS"
	| "CAPABILITIES_OR_HELP"
	| "SIMPLIFIED_EXPLANATION"
	| "CLARIFICATION_NEEDED"
	| "AMBIGUOUS_OR_UNSUPPORTED";

export interface CapabilityDefinition {
	intent: SupportedIntentType;
	name: string;
	category: CapabilityCategory;
	description: string;
	examplePhrases: string[];
	requiredEntities: string[];
	authorizedDataSources: string[];
	needsLLM: boolean;
	ttsAppropriate: boolean;
	displayCard: boolean;
	isReadOnly: boolean;
	isImplemented: boolean;
	safeFallbackResponse: string;
	suggestedQuestions: string[];
}

export const CAPABILITY_REGISTRY: Record<
	SupportedIntentType,
	CapabilityDefinition
> = {
	AVAILABLE_ROOMS: {
		intent: "AVAILABLE_ROOMS",
		name: "Available Rooms",
		category: "IMPLEMENTED_QUERY",
		description: "Lists all rooms in the PG that currently have vacant beds.",
		examplePhrases: [
			"Bhai mere PG mein kitne room khaali hain?",
			"Kaunse room khali hain?",
			"Which rooms are available?",
			"કયા રૂમ ખાલી છે?",
			"रूम कौन से खाली हैं",
			"Aur kaunse rooms available hain?",
		],
		requiredEntities: [],
		authorizedDataSources: ["PostgreSQL prisma.room", "PostgreSQL prisma.bed"],
		needsLLM: false,
		ttsAppropriate: true,
		displayCard: true,
		isReadOnly: true,
		isImplemented: true,
		safeFallbackResponse:
			"Filhal aapke PG mein koi vacant room nahi mila ya database connect nahi ho paaya.",
		suggestedQuestions: [
			"Total kitne beds available hain?",
			"Koi AC wala room khali hai?",
		],
	},

	AVAILABLE_BEDS: {
		intent: "AVAILABLE_BEDS",
		name: "Available Beds Count",
		category: "IMPLEMENTED_QUERY",
		description:
			"Calculates the total number of free beds across all rooms in the property.",
		examplePhrases: [
			"Kitne beds available hai?",
			"Kitne beds khali hain?",
			"How many beds are available?",
			"Total ketla bed khali che?",
			"મારા PG માં કેટલા બેડ ખાલી છે?",
			"कुल कितने बेड खाली हैं",
		],
		requiredEntities: [],
		authorizedDataSources: ["PostgreSQL prisma.bed"],
		needsLLM: false,
		ttsAppropriate: true,
		displayCard: true,
		isReadOnly: true,
		isImplemented: true,
		safeFallbackResponse:
			"Beds ki count fetch karne mein samasya aayi. Kripya dobara try karein.",
		suggestedQuestions: [
			"Kaunse rooms khali hain?",
			"Koi AC wala room khali hai?",
		],
	},

	TOTAL_ROOMS: {
		intent: "TOTAL_ROOMS",
		name: "Total Rooms Count",
		category: "IMPLEMENTED_QUERY",
		description:
			"Reports total rooms configured in the property and overall bed capacity.",
		examplePhrases: [
			"Mere PG mein kitne rooms hain?",
			"Total rooms kitne hain?",
			"How many total rooms in PG?",
			"કુલ કેટલા રૂમ છે?",
			"कुल कितने कमरे हैं",
		],
		requiredEntities: [],
		authorizedDataSources: ["PostgreSQL prisma.room", "PostgreSQL prisma.bed"],
		needsLLM: false,
		ttsAppropriate: true,
		displayCard: true,
		isReadOnly: true,
		isImplemented: true,
		safeFallbackResponse: "Aapke PG ke total rooms ki sankhya mil nahi saki.",
		suggestedQuestions: [
			"Kaunse rooms khali hain?",
			"Total kitne beds available hain?",
		],
	},

	SPECIFIC_ROOM_BEDS: {
		intent: "SPECIFIC_ROOM_BEDS",
		name: "Specific Room Status",
		category: "IMPLEMENTED_QUERY",
		description:
			"Checks real-time vacancy, bed count, sharing type, AC status, and rent for a specific room number.",
		examplePhrases: [
			"Room number 12 mein kitni vacancy hai?",
			"Room number 1 ka status bata.",
			"Room 102 mein kitne beds khali hain?",
			"Is room 201 available?",
			"રૂમ ૧૦૧ ખાલી છે?",
			"G-01 room status",
			"Uska rent kitna hai?",
			"Aur AC?",
			"Wahan kitne beds khali hain?",
			"Pichhle wale room ki baat kar raha hoon",
		],
		requiredEntities: ["roomNumber"],
		authorizedDataSources: ["PostgreSQL prisma.room", "PostgreSQL prisma.bed"],
		needsLLM: false,
		ttsAppropriate: true,
		displayCard: true,
		isReadOnly: true,
		isImplemented: true,
		safeFallbackResponse: "Kripya sahi room number batayein, jaise 'Room 101'.",
		suggestedQuestions: [
			"Kaunse rooms khali hain?",
			"Total kitne beds available hain?",
		],
	},

	AC_ROOM_AVAILABILITY: {
		intent: "AC_ROOM_AVAILABILITY",
		name: "AC / Non-AC Room Filter",
		category: "IMPLEMENTED_QUERY",
		description:
			"Filters vacant rooms specifically by AC or Non-AC configuration.",
		examplePhrases: [
			"Koi AC wala room khali hai?",
			"Is any AC room available?",
			"AC rooms khali hain kya?",
			"Non AC room available hai?",
			"શું કોઈ AC રૂમ ખાલી છે?",
		],
		requiredEntities: [],
		authorizedDataSources: ["PostgreSQL prisma.room", "PostgreSQL prisma.bed"],
		needsLLM: false,
		ttsAppropriate: true,
		displayCard: true,
		isReadOnly: true,
		isImplemented: true,
		safeFallbackResponse: "AC rooms ki availability check nahi ho saki.",
		suggestedQuestions: [
			"Kaunse rooms khali hain?",
			"Total kitne beds available hain?",
		],
	},

	ROOM_SHARING_RENT: {
		intent: "ROOM_SHARING_RENT",
		name: "Sharing Type Rent Rate",
		category: "IMPLEMENTED_QUERY",
		description:
			"Queries the standard rent per bed for sharing categories (Single, Double, Triple, Four).",
		examplePhrases: [
			"Triple sharing ka kitna rent hai?",
			"Double sharing ka rent kya hai?",
			"Single room rent kitna hai?",
			"Triple sharing bhav shu che?",
			"ट्रिपल शेयरिंग का कितना किराया है",
		],
		requiredEntities: ["sharingType"],
		authorizedDataSources: ["PostgreSQL prisma.room"],
		needsLLM: false,
		ttsAppropriate: true,
		displayCard: true,
		isReadOnly: true,
		isImplemented: true,
		safeFallbackResponse: "Is sharing type ka rent database mein set nahi hai.",
		suggestedQuestions: [
			"Kaunse rooms khali hain?",
			"Koi AC wala room khali hai?",
		],
	},

	RESIDENT_CHECKINS_OR_COUNT: {
		intent: "RESIDENT_CHECKINS_OR_COUNT",
		name: "Resident Check-ins & Count",
		category: "IMPLEMENTED_QUERY",
		description:
			"Checks today's resident check-ins or total active residents in the property.",
		examplePhrases: [
			"Aaj kitne residents check-in hue?",
			"Aaj koi checkin hua hai kya?",
			"Kitne residents hain PG mein?",
			"Total active residents kitne hain?",
		],
		requiredEntities: [],
		authorizedDataSources: ["PostgreSQL prisma.resident"],
		needsLLM: false,
		ttsAppropriate: true,
		displayCard: false,
		isReadOnly: true,
		isImplemented: true,
		safeFallbackResponse:
			"Resident records check karne mein samasya aayi. Kripya Dashboard mein dekhein.",
		suggestedQuestions: [
			"Kaunse rooms khali hain?",
			"Total kitne beds available hain?",
		],
	},

	BOOKING_OR_ADMISSION: {
		intent: "BOOKING_OR_ADMISSION",
		name: "Booking / Admission Guidance",
		category: "GUIDANCE_ONLY",
		description:
			"Explains the dashboard workflow for adding a new resident and checks bed availability.",
		examplePhrases: [
			"Room booking kaise karte hain?",
			"Ek bed Ramesh ke naam book karna hai",
			"Admission lena hai",
			"Naya resident kaise add karein?",
			"Booking kar do",
		],
		requiredEntities: [],
		authorizedDataSources: ["None (Guidance)"],
		needsLLM: false,
		ttsAppropriate: true,
		displayCard: false,
		isReadOnly: true,
		isImplemented: false,
		safeFallbackResponse:
			"Voice se direct booking supported nahi hai. Dashboard ke Residents section se admission karein.",
		suggestedQuestions: [
			"Kaunse rooms khali hain?",
			"Total kitne beds available hain?",
		],
	},

	CHECKOUT_OR_EXIT: {
		intent: "CHECKOUT_OR_EXIT",
		name: "Checkout Guidance",
		category: "GUIDANCE_ONLY",
		description:
			"Explains resident checkout, deposit settlement, and room vacancy updates via Dashboard.",
		examplePhrases: [
			"Ek resident checkout kar raha hai",
			"Resident chhod raha hai",
			"Checkout kaise karein?",
			"રૂમ ખાલી કરાવવો છે",
		],
		requiredEntities: [],
		authorizedDataSources: ["None (Guidance)"],
		needsLLM: false,
		ttsAppropriate: true,
		displayCard: false,
		isReadOnly: true,
		isImplemented: false,
		safeFallbackResponse:
			"Resident checkout aur deposit refund Dashboard ke Residents page se manage karein.",
		suggestedQuestions: [
			"Kaunse rooms khali hain?",
			"Total kitne beds available hain?",
		],
	},

	ROOM_CREATION_GUIDANCE: {
		intent: "ROOM_CREATION_GUIDANCE",
		name: "Room & Bed Creation Guidance",
		category: "GUIDANCE_ONLY",
		description:
			"Guides the owner on how to add rooms, beds, and manage floor configurations in Dashboard Rooms.",
		examplePhrases: [
			"एक न्यू एसी रूम एड कर दो",
			"Ek naya room add kar do",
			"Add a new AC room",
			"Naya kamra kaise add karein?",
			"Create a new room",
		],
		requiredEntities: [],
		authorizedDataSources: ["None (Guidance)"],
		needsLLM: false,
		ttsAppropriate: true,
		displayCard: false,
		isReadOnly: true,
		isImplemented: false,
		safeFallbackResponse:
			"Voice se naya room ya bed create karna supported nahi hai. Dashboard ke Rooms & Beds section se naya room add karein.",
		suggestedQuestions: [
			"Kaunse rooms khali hain?",
			"Total kitne beds available hain?",
		],
	},

	PAYMENT_COLLECTION_GUIDANCE: {
		intent: "PAYMENT_COLLECTION_GUIDANCE",
		name: "Payment Collection Guidance",
		category: "GUIDANCE_ONLY",
		description:
			"Guides the owner on how to record rent collections and issue receipts.",
		examplePhrases: [
			"Mujhe payment report dikhao.",
			"Payment record kaise karein?",
			"Kiraya jama karna hai",
			"Rent receipt kaise generate karein?",
		],
		requiredEntities: [],
		authorizedDataSources: ["None (Guidance)"],
		needsLLM: false,
		ttsAppropriate: true,
		displayCard: false,
		isReadOnly: true,
		isImplemented: false,
		safeFallbackResponse:
			"Payment report aur collection record karne ke liye Dashboard mein Payments section ka upyog karein.",
		suggestedQuestions: [
			"Kaunse rooms khali hain?",
			"Triple sharing ka kitna rent hai?",
		],
	},

	PAYMENT_HISTORY_OR_DUES: {
		intent: "PAYMENT_HISTORY_OR_DUES",
		name: "Payment History & Resident Dues",
		category: "IMPLEMENTED_QUERY",
		description:
			"Queries live resident ledger dues, identifying who has pending rent or retrieving room and payment status for specific residents.",
		examplePhrases: [
			"Kiska payment baki hai?",
			"Kiska rent pending hai?",
			"Mera rent kitna pending hai?",
			"Is month kitni payment collect hui?",
			"Ramesh ka rent paid hai ya pending?",
			"Kitna rent baki hai?",
			"किसका पेमेंट बाकी है?",
		],
		requiredEntities: [],
		authorizedDataSources: ["Resident", "RentCharge", "PaymentRecord"],
		needsLLM: false,
		ttsAppropriate: true,
		displayCard: false,
		isReadOnly: true,
		isImplemented: true,
		safeFallbackResponse:
			"Sabhi residents ke payment ledger Dashboard ke Payments section mein uplabdh hain.",
		suggestedQuestions: [
			"Kaunse rooms khali hain?",
			"Total kitne beds available hain?",
		],
	},

	AMENITIES_OR_DEPOSITS: {
		intent: "AMENITIES_OR_DEPOSITS",
		name: "Unmodeled Amenities & Policies",
		category: "UNSUPPORTED_DATA",
		description:
			"Clarifies that amenities (Wi-Fi, Food, Attached Washroom, Gate Curfew) are not in Room database.",
		examplePhrases: [
			"Kya room mein wifi hai?",
			"Mess / khana kaisa hai?",
			"Attached bathroom hai?",
			"Security deposit kitna hai?",
			"Gate closing time kya hai?",
		],
		requiredEntities: [],
		authorizedDataSources: ["None (Unmodeled)"],
		needsLLM: false,
		ttsAppropriate: true,
		displayCard: false,
		isReadOnly: true,
		isImplemented: false,
		safeFallbackResponse:
			"Ye jaankari room database mein store nahi hoti. Main room vacancy, AC aur rent bata sakta hoon.",
		suggestedQuestions: [
			"Kaunse rooms khali hain?",
			"Koi AC wala room khali hai?",
		],
	},

	GREETING: {
		intent: "GREETING",
		name: "Greeting",
		category: "CONVERSATIONAL",
		description: "Warm greeting welcoming the PG owner.",
		examplePhrases: [
			"Namaste, kaise ho?",
			"Hello dost",
			"Namaste",
			"Hi",
			"Hey",
			"Kem cho",
			"Kaise ho",
			"हेलो",
			"नमस्ते",
			"હેલો",
		],
		requiredEntities: [],
		authorizedDataSources: ["None"],
		needsLLM: false,
		ttsAppropriate: true,
		displayCard: false,
		isReadOnly: true,
		isImplemented: true,
		safeFallbackResponse:
			"Namaste! Main PG Saathi AI hoon. Main aapke PG ke rooms, beds aur rent ki jaankari de sakta hoon.",
		suggestedQuestions: [
			"Kaunse rooms khali hain?",
			"Total kitne beds available hain?",
			"Mere PG mein kitne rooms hain?",
		],
	},

	THANKS: {
		intent: "THANKS",
		name: "Thanks & Closure",
		category: "CONVERSATIONAL",
		description: "Polite response to user gratitude.",
		examplePhrases: [
			"Thank you",
			"Dhanyawad",
			"Shukriya",
			"Thanks",
			"Aabhar",
			"धन्यवाद",
			"આભાર",
		],
		requiredEntities: [],
		authorizedDataSources: ["None"],
		needsLLM: false,
		ttsAppropriate: true,
		displayCard: false,
		isReadOnly: true,
		isImplemented: true,
		safeFallbackResponse:
			"Aapka swagat hai! Agar aur koi sawal ho toh zaroor poochhein.",
		suggestedQuestions: [
			"Kaunse rooms khali hain?",
			"Total kitne beds available hain?",
		],
	},

	CAPABILITIES_OR_HELP: {
		intent: "CAPABILITIES_OR_HELP",
		name: "Capabilities & Help",
		category: "CONVERSATIONAL",
		description: "Clear summary of what the voice assistant can genuinely do.",
		examplePhrases: [
			"Tum kya kya kar sakte ho?",
			"Tum kya-kya kar sakte ho?",
			"Help karo",
			"What can you do?",
			"તમે શું કરી શકો?",
		],
		requiredEntities: [],
		authorizedDataSources: ["None"],
		needsLLM: false,
		ttsAppropriate: true,
		displayCard: false,
		isReadOnly: true,
		isImplemented: true,
		safeFallbackResponse:
			"Main aapke PG ke available rooms, beds, AC status aur room rent details real-time database se check karke bata sakta hoon.",
		suggestedQuestions: [
			"Kaunse rooms khali hain?",
			"Total kitne beds available hain?",
			"Mere PG mein kitne rooms hain?",
		],
	},

	SIMPLIFIED_EXPLANATION: {
		intent: "SIMPLIFIED_EXPLANATION",
		name: "Simplified Language Request",
		category: "CONVERSATIONAL",
		description:
			"Explains the assistant's main role in simple, everyday Hindi/Hinglish.",
		examplePhrases: [
			"Samajh nahi aaya, simple language mein batao.",
			"Aasan bhasha mein samjhao",
			"Simple bhasha mein bolo",
		],
		requiredEntities: [],
		authorizedDataSources: ["None"],
		needsLLM: false,
		ttsAppropriate: true,
		displayCard: false,
		isReadOnly: true,
		isImplemented: true,
		safeFallbackResponse:
			"Seedhi bhasha mein: Main aapke PG ka digital saathi hoon. Aap mujhse poochh sakte hain ki kaunsa room khali hai, kitne bed bache hain, aur kis room ka kya rent hai.",
		suggestedQuestions: [
			"Kaunse rooms khali hain?",
			"Total kitne beds available hain?",
		],
	},

	CLARIFICATION_NEEDED: {
		intent: "CLARIFICATION_NEEDED",
		name: "Clarification Needed",
		category: "CONVERSATIONAL",
		description: "Triggered when a room reference is ambiguous or incomplete.",
		examplePhrases: ["Woh wala", "Uska status"],
		requiredEntities: [],
		authorizedDataSources: ["None"],
		needsLLM: false,
		ttsAppropriate: true,
		displayCard: false,
		isReadOnly: true,
		isImplemented: true,
		safeFallbackResponse:
			"Aap kis room ke baare mein poochh rahe hain? Kripya room number batayein, jaise 'Room 101'.",
		suggestedQuestions: [
			"Kaunse rooms khali hain?",
			"Total kitne beds available hain?",
		],
	},

	AMBIGUOUS_OR_UNSUPPORTED: {
		intent: "AMBIGUOUS_OR_UNSUPPORTED",
		name: "Ambiguous or Unsupported Query",
		category: "CONVERSATIONAL",
		description:
			"Polite fallback for unrecognized queries that are out of scope.",
		examplePhrases: [
			"Aaj mausam kaisa hai?",
			"Cricket score kya hai?",
			"Random query",
		],
		requiredEntities: [],
		authorizedDataSources: ["None"],
		needsLLM: true, // Only this intent may consult Groq LLM
		ttsAppropriate: true,
		displayCard: false,
		isReadOnly: true,
		isImplemented: true,
		safeFallbackResponse:
			"Main aapke PG ke khali rooms, available beds aur room rent ke sawal bata sakta hoon. Kripya poochhein: 'Kaunse rooms khali hain?' ya 'Room 1 ka status'.",
		suggestedQuestions: [
			"Kaunse rooms khali hain?",
			"Total kitne beds available hain?",
			"Mere PG mein kitne rooms hain?",
		],
	},
};

/**
 * Validates if an intent is recognized in the Capability Registry.
 */
export function isValidIntent(intent: string): intent is SupportedIntentType {
	return Object.prototype.hasOwnProperty.call(CAPABILITY_REGISTRY, intent);
}

/**
 * Returns the capability definition or the default AMBIGUOUS fallback.
 */
export function getCapability(
	intent: SupportedIntentType
): CapabilityDefinition {
	return (
		CAPABILITY_REGISTRY[intent] || CAPABILITY_REGISTRY.AMBIGUOUS_OR_UNSUPPORTED
	);
}
