"use client";

import React, { useState, useRef, useEffect } from "react";
import { formatINR } from "@/libs/formatters";

interface RoomVacancyDetail {
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

interface QueryResponseData {
	success: boolean;
	intent: string;
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
	context?: {
		lastQueriedRoomNumber?: string | null;
		timestamp?: number;
	};
	suggestions?: string[];
}

interface Message {
	id: string;
	sender: "user" | "assistant";
	text: string;
	timestamp: Date;
	data?: QueryResponseData;
	isVoice?: boolean;
}

// Maximum recording duration: 30 seconds limit to allow complete questions without abrupt cutoffs
const MAX_RECORDING_SECONDS = 30;
// Minimum audio size to reject accidental micro-clicks
const MIN_AUDIO_BYTES = 1024;

export default function PGSaathiAssistant() {
	const [isOpen, setIsOpen] = useState(false);
	const [isRecording, setIsRecording] = useState(false);
	const [recordingTime, setRecordingTime] = useState(0);
	const [processingState, setProcessingState] = useState<
		"idle" | "transcribing" | "querying" | "speaking" | "error"
	>("idle");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [typedInput, setTypedInput] = useState("");
	const [selectedLanguage, setSelectedLanguage] = useState<
		"auto" | "hi-IN" | "gu-IN" | "en-IN"
	>("auto");

	// Strict Credit Safeguard: Voice Reply Toggle (Defaults to ON, allows 1-click Text-Only Mode)
	const [voiceRepliesEnabled, setVoiceRepliesEnabled] = useState(true);

	// Context tracking for conversational follow-ups
	const [conversationContext, setConversationContext] = useState<{
		lastQueriedRoomNumber?: string | null;
		timestamp?: number;
	}>({});

	const [messages, setMessages] = useState<Message[]>([
		{
			id: "welcome",
			sender: "assistant",
			text: "Namaste! Main hoon PG Saathi AI. Aap mujhse bol kar ya type karke apne PG ke khali rooms aur beds ke baare mein poochh sakte hain. Aap follow-up sawal bhi poochh sakte hain jaise: 'Room 102 mein?' ya 'Uska rent kitna hai?'.",
			timestamp: new Date(),
		},
	]);

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const timerRef = useRef<NodeJS.Timeout | null>(null);
	const messagesEndRef = useRef<HTMLDivElement | null>(null);
	const recordingStartTimeRef = useRef<number>(0);

	// VAD (Voice Activity Detection) & Live Audio Waveform state
	const [audioLevel, setAudioLevel] = useState(0);
	const [hasSpoken, setHasSpoken] = useState(false);
	const audioContextRef = useRef<AudioContext | null>(null);
	const hasDetectedSpeechRef = useRef(false);
	const animFrameRef = useRef<number | null>(null);
	const pcmChunksRef = useRef<Float32Array[]>([]);
	const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

	// Dedicated Audio Player for Gnani Timbre TTS
	const currentAudioRef = useRef<HTMLAudioElement | null>(null);
	// Cache for generated audio URLs to NEVER repeat TTS calls on rerender or replay
	const audioCacheRef = useRef<Map<string, string>>(new Map());
	// Strict concurrency guard against duplicate voice/audio submissions
	const isSubmittingRef = useRef(false);
	// Active query race condition lock & correlation tracking
	const activeQueryIdRef = useRef<string | null>(null);

	// Auto-scroll to latest message
	useEffect(() => {
		if (isOpen) {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [messages, isOpen, processingState]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
			if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
			if (audioContextRef.current) {
				audioContextRef.current.close().catch(() => {});
			}
			if (currentAudioRef.current) {
				currentAudioRef.current.pause();
				currentAudioRef.current = null;
			}
		};
	}, []);

	// Handle Recording Countdown Timer (10 Seconds Max Safeguard)
	useEffect(() => {
		if (isRecording) {
			setRecordingTime(0);
			timerRef.current = setInterval(() => {
				setRecordingTime((prev) => {
					if (prev + 1 >= MAX_RECORDING_SECONDS) {
						stopRecording();
						return MAX_RECORDING_SECONDS;
					}
					return prev + 1;
				});
			}, 1000);
		} else {
			if (timerRef.current) clearInterval(timerRef.current);
			setRecordingTime(0);
		}
	}, [isRecording]);

	// 1. Start Voice Recording with VAD Auto-Stop on Silence
	const startRecording = async () => {
		setErrorMessage(null);
		audioChunksRef.current = [];
		hasDetectedSpeechRef.current = false;
		setHasSpoken(false);

		// Stop any currently playing speech response before recording
		stopAudioPlayback();

		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			setErrorMessage(
				"Aapke browser mein audio recording support nahi hai. Kripya niche type karein."
			);
			return;
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					channelCount: 1,
					sampleRate: 16000,
					echoCancellation: true,
					noiseSuppression: true,
				},
			});

			let mimeType = "audio/webm";
			if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
				mimeType = "audio/webm;codecs=opus";
			} else if (MediaRecorder.isTypeSupported("audio/mp4")) {
				mimeType = "audio/mp4";
			} else if (MediaRecorder.isTypeSupported("audio/ogg")) {
				mimeType = "audio/ogg";
			}

			const recorder = new MediaRecorder(stream, { mimeType });
			mediaRecorderRef.current = recorder;
			recordingStartTimeRef.current = Date.now();

			// Setup AudioContext for VAD (Voice Activity Detection)
			const AudioContextClass =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext })
					.webkitAudioContext;

			if (AudioContextClass) {
				const audioCtx = new AudioContextClass();
				audioContextRef.current = audioCtx;
				const analyser = audioCtx.createAnalyser();
				analyser.fftSize = 256;
				analyser.smoothingTimeConstant = 0.3;
				const source = audioCtx.createMediaStreamSource(stream);
				source.connect(analyser);

				// Direct PCM recording pipeline for 100% native 16kHz WAV (bypasses WebM issues)
				pcmChunksRef.current = [];
				const scriptProcessor = audioCtx.createScriptProcessor(4096, 1, 1);
				scriptProcessorRef.current = scriptProcessor;
				scriptProcessor.onaudioprocess = (e) => {
					const input = e.inputBuffer.getChannelData(0);
					pcmChunksRef.current.push(new Float32Array(input));
				};
				source.connect(scriptProcessor);
				scriptProcessor.connect(audioCtx.destination);

				const dataArray = new Uint8Array(analyser.frequencyBinCount);
				let silenceStart: number | null = null;

				const checkVolume = () => {
					if (!analyser) return;
					analyser.getByteFrequencyData(dataArray);

					let sum = 0;
					for (let i = 0; i < dataArray.length; i++) {
						sum += dataArray[i];
					}
					const average = sum / dataArray.length;
					const normalized = Math.min(100, Math.round((average / 128) * 100));
					setAudioLevel(normalized);

					// Voice detection threshold & silence timeout (adjusted to prevent laptop fan/ambient noise false triggers)
					const SPEECH_THRESHOLD = 16;
					const SILENCE_TIMEOUT_MS = 1400; // 1.4s pause after speech auto-completes utterance
					const INITIAL_NO_SPEECH_TIMEOUT_MS = 4000; // 4s idle background noise with no speech auto-cancels

					const now = Date.now();
					const elapsedSinceStart = now - recordingStartTimeRef.current;

					if (normalized > SPEECH_THRESHOLD) {
						hasDetectedSpeechRef.current = true;
						setHasSpoken(true);
						silenceStart = null;
					} else if (hasDetectedSpeechRef.current) {
						if (!silenceStart) {
							silenceStart = now;
						} else if (now - silenceStart > SILENCE_TIMEOUT_MS) {
							// User finished speaking! Auto-stop and submit without needing second tap
							stopRecording();
							return;
						}
					} else if (elapsedSinceStart > INITIAL_NO_SPEECH_TIMEOUT_MS) {
						// User hasn't spoken anything (only background noise/silence for 4s)
						cancelRecording();
						return;
					}

					animFrameRef.current = requestAnimationFrame(checkVolume);
				};

				animFrameRef.current = requestAnimationFrame(checkVolume);
			}

			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					audioChunksRef.current.push(event.data);
				}
			};

			recorder.onstop = async () => {
				// Immediately release microphone hardware track and analyser
				if (scriptProcessorRef.current) {
					try {
						scriptProcessorRef.current.disconnect();
					} catch {}
					scriptProcessorRef.current = null;
				}
				stream.getTracks().forEach((track) => track.stop());
				if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
				const ctxSampleRate = audioContextRef.current?.sampleRate || 16000;
				if (audioContextRef.current) {
					audioContextRef.current.close().catch(() => {});
					audioContextRef.current = null;
				}
				setAudioLevel(0);

				const durationMs = Date.now() - recordingStartTimeRef.current;

				// Strict Credit Safeguard: Reject micro-recordings under 500ms
				if (durationMs < 500) {
					setErrorMessage(
						"Recording bahut chhoti thi. Kripya microphone button dabayein aur sawal bolen."
					);
					setProcessingState("idle");
					return;
				}

				// Preferred: Build 100% native uncompressed 16-bit PCM WAV directly from raw microphone samples
				const totalPcmSamples = pcmChunksRef.current.reduce(
					(acc, c) => acc + c.length,
					0
				);
				if (totalPcmSamples > 1600) {
					const mergedSamples = new Float32Array(totalPcmSamples);
					let offset = 0;
					for (const chunk of pcmChunksRef.current) {
						mergedSamples.set(chunk, offset);
						offset += chunk.length;
					}
					const downsampled = downsampleTo16k(mergedSamples, ctxSampleRate);
					const wavBuffer = encodePCMToWAV(downsampled, 16000);
					const wavBlob = new Blob([wavBuffer], { type: "audio/wav" });
					await processVoiceAudio(wavBlob);
					return;
				}

				const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
				if (audioBlob.size < MIN_AUDIO_BYTES) {
					setErrorMessage(
						"Recording bahut chhoti thi. Kripya microphone button dabayein aur sawal bolen."
					);
					setProcessingState("idle");
					return;
				}

				await processVoiceAudio(audioBlob);
			};

			recorder.start(200);
			setIsRecording(true);
		} catch (err: any) {
			console.error("Microphone access error:", err);
			if (
				err.name === "NotAllowedError" ||
				err.name === "PermissionDeniedError"
			) {
				setErrorMessage(
					"Microphone permission deny ho gayi hai. Kripya browser address bar se mic allow karein ya niche type karein."
				);
			} else {
				setErrorMessage(
					"Microphone access nahi ho saka. Kripya niche text box use karein."
				);
			}
		}
	};

	// 2. Stop Voice Recording (Normal Submit)
	const stopRecording = () => {
		if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
		if (audioContextRef.current) {
			audioContextRef.current.close().catch(() => {});
			audioContextRef.current = null;
		}
		setAudioLevel(0);

		if (
			mediaRecorderRef.current &&
			mediaRecorderRef.current.state === "recording"
		) {
			mediaRecorderRef.current.stop();
			setIsRecording(false);
		}
	};

	// Cancel Voice Recording (Discard without submitting)
	const cancelRecording = () => {
		if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
		if (audioContextRef.current) {
			audioContextRef.current.close().catch(() => {});
			audioContextRef.current = null;
		}
		setAudioLevel(0);

		if (
			mediaRecorderRef.current &&
			mediaRecorderRef.current.state === "recording"
		) {
			mediaRecorderRef.current.onstop = () => {
				setProcessingState("idle");
			};
			mediaRecorderRef.current.stop();
			setIsRecording(false);
		}
	};

	// 3. Stop Audio Playback immediately
	const stopAudioPlayback = () => {
		if (currentAudioRef.current) {
			currentAudioRef.current.pause();
			currentAudioRef.current.currentTime = 0;
			currentAudioRef.current = null;
		}
		if (processingState === "speaking") {
			setProcessingState("idle");
		}
	};

	// Helper to encode Float32 PCM to 16-bit Mono WAV
	const encodePCMToWAV = (
		samples: Float32Array,
		sampleRate: number
	): ArrayBuffer => {
		const buffer = new ArrayBuffer(44 + samples.length * 2);
		const view = new DataView(buffer);

		const writeStr = (offset: number, str: string) => {
			for (let i = 0; i < str.length; i++) {
				view.setUint8(offset + i, str.charCodeAt(i));
			}
		};

		writeStr(0, "RIFF");
		view.setUint32(4, 36 + samples.length * 2, true);
		writeStr(8, "WAVE");
		writeStr(12, "fmt ");
		view.setUint32(16, 16, true);
		view.setUint16(20, 1, true); // PCM
		view.setUint16(22, 1, true); // Mono
		view.setUint32(24, sampleRate, true);
		view.setUint32(28, sampleRate * 2, true);
		view.setUint16(32, 2, true);
		view.setUint16(34, 16, true);
		writeStr(36, "data");
		view.setUint32(40, samples.length * 2, true);

		let offset = 44;
		for (let i = 0; i < samples.length; i++, offset += 2) {
			const s = Math.max(-1, Math.min(1, samples[i]));
			view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
		}
		return buffer;
	};

	// Downsample float32 audio samples to 16kHz for Indic speech recognition
	const downsampleTo16k = (
		buffer: Float32Array,
		inputSampleRate: number
	): Float32Array => {
		if (inputSampleRate === 16000) return buffer;
		const ratio = inputSampleRate / 16000;
		const newLength = Math.round(buffer.length / ratio);
		const result = new Float32Array(newLength);
		let offsetResult = 0;
		let offsetBuffer = 0;
		while (offsetResult < result.length) {
			const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
			let accum = 0;
			let count = 0;
			for (
				let i = offsetBuffer;
				i < nextOffsetBuffer && i < buffer.length;
				i++
			) {
				accum += buffer[i];
				count++;
			}
			result[offsetResult] = count > 0 ? accum / count : 0;
			offsetResult++;
			offsetBuffer = nextOffsetBuffer;
		}
		return result;
	};

	// Convert input blob to 16kHz mono WAV supported natively by Gnani Prisma
	const convertBlobToWav = async (blob: Blob): Promise<Blob> => {
		try {
			const AudioContextClass =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext })
					.webkitAudioContext;
			if (!AudioContextClass) return blob;

			const arrayBuffer = await blob.arrayBuffer();
			const audioCtx = new AudioContextClass();
			const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

			const targetSampleRate = 16000;
			const offlineCtx = new OfflineAudioContext(
				1,
				Math.ceil(audioBuffer.duration * targetSampleRate),
				targetSampleRate
			);
			const source = offlineCtx.createBufferSource();
			source.buffer = audioBuffer;
			source.connect(offlineCtx.destination);
			source.start(0);

			const renderedBuffer = await offlineCtx.startRendering();
			const pcmData = renderedBuffer.getChannelData(0);
			const wavBuffer = encodePCMToWAV(pcmData, targetSampleRate);
			await audioCtx.close();
			return new Blob([wavBuffer], { type: "audio/wav" });
		} catch (err) {
			console.warn("WAV conversion fallback to original format:", err);
			return blob;
		}
	};

	// 4. Send Audio to STT API & Query Database (Guarded against duplicate submissions)
	const processVoiceAudio = async (audioBlob: Blob) => {
		if (isSubmittingRef.current) return;
		isSubmittingRef.current = true;

		setProcessingState("transcribing");
		setErrorMessage(null);

		try {
			// Convert audio to 16kHz mono WAV for Gnani Prisma compatibility
			const finalBlob = await convertBlobToWav(audioBlob);
			const fileName = finalBlob.type.includes("wav")
				? "recording.wav"
				: "recording.webm";

			const formData = new FormData();
			formData.append("audio", finalBlob, fileName);
			formData.append("languageCode", selectedLanguage);

			const transcribeRes = await fetch("/api/user/voice/transcribe", {
				method: "POST",
				body: formData,
			});

			const transcribeData = await transcribeRes.json();

			if (!transcribeRes.ok) {
				if (transcribeData.code === "GNANI_API_KEY_MISSING") {
					setErrorMessage(
						"Gnani STT key configure nahi hai (.env mein GNANI_API_KEY set karein). Niche text box se try karein!"
					);
				} else if (transcribeData.code === "GNANI_RATE_LIMIT") {
					setErrorMessage(
						"Gnani credit quota khatam ho gayi hai. Kuch der baad try karein ya niche type karein."
					);
				} else {
					// Show the actual API error if available so the owner can debug
					const errorDetail = transcribeData.detail
						? ` (${transcribeData.detail})`
						: "";
					setErrorMessage(
						(transcribeData.message || "Voice transcript nahi ho saki.") +
							errorDetail +
							" Kripya dobara bolein ya type karein."
					);
				}
				setProcessingState("idle");
				return;
			}

			const transcript = transcribeData.transcript?.trim();
			const isSilenceArtifact = (text: string) => {
				const clean = text
					.toLowerCase()
					.replace(/[.,!?:;'"_—-]/g, "")
					.replace(/\s+/g, " ")
					.trim();
				return [
					"the end",
					"end",
					"thank you",
					"thank you for watching",
					"thanks for watching",
					"thank you so much",
					"subtitles by",
					"please subscribe",
					"like and subscribe",
					"you",
					"bye",
					"goodbye",
				].includes(clean);
			};

			if (!transcript || isSilenceArtifact(transcript)) {
				setErrorMessage(
					"Kuchh saaf sunai nahi diya. Kripya microphone ke paas aakar saaf aawaz mein sawal bolein."
				);
				setProcessingState("idle");
				return;
			}

			// Add recognized user message to chat
			addMessage({
				sender: "user",
				text: transcript,
				isVoice: true,
			});

			// Now query room/bed availability with transcript and conversation context
			await executeQuery(transcript);
		} catch (err: any) {
			console.error("Audio processing failed:", err);
			setErrorMessage(
				"Network error: Audio process nahi ho saka. Kripya check karein."
			);
			setProcessingState("idle");
		} finally {
			isSubmittingRef.current = false;
		}
	};

	// 5. Execute Room/Bed Query via API with Conversation Context
	const executeQuery = async (queryText: string) => {
		const currentQueryId =
			Math.random().toString(36).substring(2, 9) + Date.now();
		activeQueryIdRef.current = currentQueryId;

		setProcessingState("querying");
		setErrorMessage(null);

		try {
			const res = await fetch("/api/user/voice/query", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query: queryText,
					context: conversationContext,
					correlationId: currentQueryId,
				}),
			});

			const data: QueryResponseData & { correlationId?: string } =
				await res.json();

			// Race-condition guard: discard response if user initiated a newer query
			if (activeQueryIdRef.current !== currentQueryId) {
				return;
			}

			if (!res.ok) {
				setErrorMessage(
					(data as any).message ||
						"Query fail ho gayi. Kripya dobara try karein."
				);
				setProcessingState("idle");
				return;
			}

			const assistantMsgId = Math.random().toString(36).substring(2, 9);

			addMessage({
				id: assistantMsgId,
				sender: "assistant",
				text: data.spokenAnswer,
				data,
			});

			// Update conversational memory context for follow-ups
			if (data.context) {
				setConversationContext((prev) => ({
					...prev,
					lastQueriedRoomNumber: data.context?.lastQueriedRoomNumber,
					timestamp: data.context?.timestamp || Date.now(),
				}));
			}

			// Optional Spoken Response via Gnani Timbre TTS
			if (voiceRepliesEnabled && data.spokenAnswer) {
				await playSpokenResponse(assistantMsgId, data.spokenAnswer);
			} else {
				setProcessingState("idle");
			}
		} catch (err) {
			if (activeQueryIdRef.current === currentQueryId) {
				console.error("Query execution error:", err);
				setErrorMessage(
					"Query process nahi ho saki. Internet connection check karein."
				);
				setProcessingState("idle");
			}
		}
	};

	// 6. Play Spoken Response with Caching Guard to prevent credit burning
	const playSpokenResponse = async (messageId: string, text: string) => {
		// Stop any previous audio
		stopAudioPlayback();

		// Check client cache first: If already synthesized, reuse without burning credits
		const cachedUrl = audioCacheRef.current.get(messageId);
		if (cachedUrl) {
			playAudioUrl(cachedUrl);
			return;
		}

		setProcessingState("speaking");

		try {
			const res = await fetch("/api/user/voice/tts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					text,
					language: selectedLanguage,
				}),
			});

			if (!res.ok) {
				// If TTS fails (e.g. key missing or credit limit), do not block UI, fall back silently
				console.warn(
					"TTS generation not available or failed. Falling back to text-only mode."
				);
				setProcessingState("idle");
				return;
			}

			const audioBlob = await res.blob();
			const audioUrl = URL.createObjectURL(audioBlob);
			audioCacheRef.current.set(messageId, audioUrl);

			playAudioUrl(audioUrl);
		} catch (err) {
			console.warn("TTS network error:", err);
			setProcessingState("idle");
		}
	};

	const playAudioUrl = (url: string) => {
		const audio = new Audio(url);
		currentAudioRef.current = audio;
		setProcessingState("speaking");

		audio.onended = () => {
			setProcessingState("idle");
			currentAudioRef.current = null;
		};

		audio.onerror = () => {
			setProcessingState("idle");
			currentAudioRef.current = null;
		};

		audio.play().catch((err) => {
			console.warn("Audio autoplay blocked or cancelled:", err);
			setProcessingState("idle");
		});
	};

	// Helper to append message
	const addMessage = (
		msg: Omit<Message, "id" | "timestamp"> & { id?: string }
	) => {
		setMessages((prev) => [
			...prev,
			{
				...msg,
				id: msg.id || Math.random().toString(36).substring(2, 9),
				timestamp: new Date(),
			},
		]);
	};

	// Handle Typed Query Submit (Zero Audio / Zero Gnani Credit consumption)
	const handleTypedSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const text = typedInput.trim();
		if (!text) return;

		setTypedInput("");
		setErrorMessage(null);

		addMessage({
			sender: "user",
			text,
			isVoice: false,
		});

		executeQuery(text);
	};

	// Quick suggestion click
	const handleSuggestionClick = (queryText: string) => {
		setTypedInput("");
		setErrorMessage(null);
		addMessage({
			sender: "user",
			text: queryText,
			isVoice: false,
		});
		executeQuery(queryText);
	};

	// Render message cards safely
	const renderMessageCards = (data?: QueryResponseData) => {
		if (
			!data ||
			!data.success ||
			data.intent === "AMBIGUOUS_OR_UNSUPPORTED" ||
			data.intent === "CAPABILITIES_OR_HELP" ||
			data.intent === "GREETING" ||
			data.intent === "THANKS" ||
			data.intent === "BOOKING_OR_ADMISSION" ||
			data.intent === "CHECKOUT_OR_EXIT" ||
			data.intent === "ROOM_CREATION_GUIDANCE" ||
			data.intent === "PAYMENT_COLLECTION_GUIDANCE" ||
			data.intent === "PAYMENT_HISTORY_OR_DUES" ||
			data.intent === "RESIDENT_CHECKINS_OR_COUNT" ||
			data.intent === "SIMPLIFIED_EXPLANATION" ||
			data.intent === "AMENITIES_OR_DEPOSITS" ||
			data.intent === "CLARIFICATION_NEEDED" ||
			data.intent === "TOTAL_ROOMS" ||
			data.intent === "AVAILABLE_BEDS"
		) {
			return null;
		}

		if (data.intent === "SPECIFIC_ROOM_BEDS") {
			if (!data.queriedRoom) return null;
			return (
				<div className='mt-3 space-y-2 border-t border-stroke/40 pt-2 dark:border-stroke-dark/40'>
					<QueriedRoomCard room={data.queriedRoom} />
				</div>
			);
		}

		if (data.vacantRooms && data.vacantRooms.length > 0) {
			const totalBedsInList = data.vacantRooms.reduce(
				(sum, r) => sum + r.availableBedCount,
				0
			);
			return (
				<div className='mt-3 space-y-2 border-t border-stroke/40 pt-2 dark:border-stroke-dark/40'>
					<div className='flex items-center justify-between text-xs'>
						<span className='font-semibold text-dark dark:text-white'>
							📍 {data.property.name}
						</span>
						<span className='rounded bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'>
							{totalBedsInList} Beds Khali
						</span>
					</div>
					<VacantRoomsList rooms={data.vacantRooms} />
				</div>
			);
		}

		return null;
	};

	// Render interactive suggestion pills
	const renderMessageSuggestions = (suggestions?: string[]) => {
		if (!suggestions || suggestions.length === 0) return null;

		return (
			<div className='mt-3 flex flex-wrap gap-1.5 border-t border-stroke/30 pt-2 dark:border-stroke-dark/30'>
				{suggestions.map((sug, sIdx) => (
					<button
						key={sIdx}
						onClick={() => handleSuggestionClick(sug)}
						className='rounded-full border border-emerald-300 bg-emerald-50/80 px-2.5 py-1 text-[11px] font-medium text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300'
					>
						{sug}
					</button>
				))}
			</div>
		);
	};

	return (
		<>
			{/* Floating Trigger Button */}
			<div className='fixed bottom-6 right-6 z-[999]'>
				<button
					onClick={() => setIsOpen((prev) => !prev)}
					aria-label='Open PG Saathi Voice Assistant'
					className='group relative flex items-center gap-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-white shadow-xl transition-all duration-300 hover:scale-105 hover:from-emerald-500 hover:to-teal-500 hover:shadow-emerald-500/25 active:scale-95'
				>
					{/* Animated Pulse Ring */}
					<span className='absolute -inset-1 animate-pulse rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 opacity-40 blur-sm group-hover:opacity-75' />

					{/* Microphone Icon */}
					<span className='relative flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white'>
						<svg
							className='h-5 w-5'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth='2'
								d='M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 02-3-3V5a3 3 0 116 0v6a3 3 0 02-3 3z'
							/>
						</svg>
					</span>

					<div className='relative text-left'>
						<div className='text-xs font-medium uppercase tracking-wider text-emerald-100'>
							Voice AI
						</div>
						<div className='text-sm font-bold tracking-tight'>PG Saathi</div>
					</div>

					<span className='relative ml-1 rounded-full bg-emerald-700/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-100'>
						Rooms &amp; Beds
					</span>
				</button>
			</div>

			{/* Assistant Drawer Panel */}
			{isOpen && (
				<div className='animate-fade-in fixed inset-0 z-[9999] flex justify-end bg-black/40 backdrop-blur-sm'>
					{/* Backdrop click to close */}
					<div
						className='flex-1'
						onClick={() => {
							if (isRecording) stopRecording();
							stopAudioPlayback();
							setIsOpen(false);
						}}
					/>

					<div className='flex h-full w-full max-w-lg flex-col bg-[#FBF9F5] shadow-2xl dark:bg-[#071711] sm:border-l sm:border-stroke dark:sm:border-stroke-dark'>
						{/* Drawer Header */}
						<div className='flex items-center justify-between border-b border-[#E8E3D8] bg-white px-5 py-4 dark:border-slate-800 dark:bg-[#0E1713]'>
							<div className='flex items-center gap-3'>
								<div className='flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400'>
									<svg
										className='h-5 w-5'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth='2'
											d='M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 02-3-3V5a3 3 0 116 0v6a3 3 0 02-3 3z'
										/>
									</svg>
								</div>
								<div>
									<div className='flex items-center gap-2'>
										<h2 className='font-satoshi text-lg font-bold text-dark dark:text-white'>
											PG Saathi AI
										</h2>
										<span className='rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'>
											Voice & Follow-ups
										</span>
									</div>
									<p className='text-xs text-body dark:text-gray-4'>
										Conversational Room Assistant (Hindi / Guj / Eng)
									</p>
								</div>
							</div>

							<div className='flex items-center gap-2'>
								{/* Strict Credit Safeguard: Voice Reply Toggle Button */}
								<button
									onClick={() => {
										const nextState = !voiceRepliesEnabled;
										setVoiceRepliesEnabled(nextState);
										if (!nextState) stopAudioPlayback();
									}}
									className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
										voiceRepliesEnabled
											? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
											: "bg-gray-2 text-body dark:bg-dark-2 dark:text-gray-4"
									}`}
									title={
										voiceRepliesEnabled
											? "Voice Replies Active (Uses Timbre TTS). Click to switch to Text-Only mode."
											: "Text-Only Mode Active (Uses 0 TTS credits). Click to enable spoken replies."
									}
								>
									<span>{voiceRepliesEnabled ? "🔊" : "🔇"}</span>
									<span className='hidden sm:inline'>
										{voiceRepliesEnabled ? "Voice On" : "Text Only"}
									</span>
								</button>

								{/* Language Selector */}
								<select
									value={selectedLanguage}
									onChange={(e) => setSelectedLanguage(e.target.value as any)}
									className='rounded-md border border-stroke bg-gray-1 px-2 py-1 text-xs font-medium text-dark dark:border-stroke-dark dark:bg-dark-2 dark:text-white'
									title='Select Language'
								>
									<option value='auto'>Auto (Eng / Hin / Guj)</option>
									<option value='hi-IN'>Hindi / Hinglish</option>
									<option value='gu-IN'>Gujarati (ગુજરાતી)</option>
									<option value='en-IN'>English</option>
								</select>

								{/* Close Button */}
								<button
									onClick={() => {
										if (isRecording) stopRecording();
										stopAudioPlayback();
										setIsOpen(false);
									}}
									className='rounded-md p-1.5 text-body hover:bg-gray-100 dark:text-gray-4 dark:hover:bg-dark-2'
									aria-label='Close Drawer'
								>
									<svg
										className='h-5 w-5'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth='2'
											d='M6 18L18 6M6 6l12 12'
										/>
									</svg>
								</button>
							</div>
						</div>

						{/* Quick Suggestions Chips (With Contextual Follow-ups) */}
						<div className='border-b border-[#E8E3D8] bg-[#F7F4EC] px-4 py-2.5 dark:border-slate-800 dark:bg-[#0A1F18]'>
							<div className='flex items-center justify-between'>
								<span className='text-[11px] font-semibold uppercase tracking-wider text-body dark:text-gray-4'>
									{conversationContext.lastQueriedRoomNumber
										? `Follow-up on Room ${conversationContext.lastQueriedRoomNumber}`
										: "Try Asking"}
								</span>
								{conversationContext.lastQueriedRoomNumber && (
									<button
										onClick={() => setConversationContext({})}
										className='text-[10px] text-emerald-700 underline dark:text-emerald-400'
									>
										Reset Context
									</button>
								)}
							</div>
							<div className='mt-1.5 flex flex-wrap gap-1.5'>
								{conversationContext.lastQueriedRoomNumber ? (
									<>
										<button
											onClick={() =>
												handleSuggestionClick(
													`Room ${conversationContext.lastQueriedRoomNumber} ka rent kitna hai?`
												)
											}
											className='rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
										>
											💰 Uska rent kitna hai?
										</button>
										<button
											onClick={() =>
												handleSuggestionClick(
													`Kya Room ${conversationContext.lastQueriedRoomNumber} mein AC hai?`
												)
											}
											className='rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
										>
											❄️ Kya wahan AC hai?
										</button>
										<button
											onClick={() =>
												handleSuggestionClick("Aur kaunse rooms khali hain?")
											}
											className='rounded-full border border-stroke bg-white px-3 py-1 text-xs text-dark transition hover:border-emerald-500 hover:text-emerald-700 dark:border-stroke-dark dark:bg-dark-2 dark:text-white dark:hover:text-emerald-300'
										>
											🛏️ Aur kaunse rooms khali hain?
										</button>
									</>
								) : (
									<>
										<button
											onClick={() =>
												handleSuggestionClick(
													"Mere PG mein kitne beds khali hain?"
												)
											}
											className='rounded-full border border-stroke bg-white px-3 py-1 text-xs text-dark transition hover:border-emerald-500 hover:text-emerald-700 dark:border-stroke-dark dark:bg-dark-2 dark:text-white dark:hover:text-emerald-300'
										>
											📊 Kitne beds khali hain?
										</button>
										<button
											onClick={() =>
												handleSuggestionClick("Kaunse rooms khali hain?")
											}
											className='rounded-full border border-stroke bg-white px-3 py-1 text-xs text-dark transition hover:border-emerald-500 hover:text-emerald-700 dark:border-stroke-dark dark:bg-dark-2 dark:text-white dark:hover:text-emerald-300'
										>
											🛏️ Kaunse rooms khali hain?
										</button>
										<button
											onClick={() => handleSuggestionClick("Room 102 mein?")}
											className='rounded-full border border-stroke bg-white px-3 py-1 text-xs text-dark transition hover:border-emerald-500 hover:text-emerald-700 dark:border-stroke-dark dark:bg-dark-2 dark:text-white dark:hover:text-emerald-300'
										>
											🔍 Room 102 mein?
										</button>
									</>
								)}
							</div>
						</div>

						{/* Messages Scroll Area */}
						<div className='flex-1 space-y-4 overflow-y-auto p-4'>
							{messages.map((msg) => (
								<div
									key={msg.id}
									className={`flex flex-col ${
										msg.sender === "user" ? "items-end" : "items-start"
									}`}
								>
									{/* Bubble Header */}
									<div className='mb-1 flex items-center gap-1.5 text-[11px] text-body dark:text-gray-4'>
										{msg.sender === "user" ? (
											<>
												<span>Aap</span>
												{msg.isVoice && (
													<span className='flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400'>
														🎤 Voice
													</span>
												)}
											</>
										) : (
											<div className='flex items-center gap-2'>
												<span className='font-semibold text-emerald-700 dark:text-emerald-400'>
													PG Saathi
												</span>
												{voiceRepliesEnabled && (
													<button
														onClick={() => playSpokenResponse(msg.id, msg.text)}
														className='text-xs text-body hover:text-emerald-600 dark:text-gray-4 dark:hover:text-emerald-400'
														title='Replay Audio Response (Uses cache, 0 credits)'
													>
														🔊 Play
													</button>
												)}
											</div>
										)}
									</div>

									{/* Message Body */}
									<div
										className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
											msg.sender === "user"
												? "rounded-br-none bg-emerald-600 text-white"
												: "rounded-bl-none border border-[#E8E3D8] bg-white text-dark dark:border-slate-800 dark:bg-[#0E1713] dark:text-white"
										}`}
									>
										{msg.text}

										{renderMessageCards(msg.data)}
										{msg.sender === "assistant" &&
											msg.id ===
												[...messages]
													.reverse()
													.find((m) => m.sender === "assistant")?.id &&
											renderMessageSuggestions(msg.data?.suggestions)}
									</div>
								</div>
							))}

							{/* Processing Indicator */}
							{processingState !== "idle" && (
								<div className='flex items-center justify-between rounded-xl border border-stroke bg-white p-3 text-xs shadow-sm dark:border-stroke-dark dark:bg-[#0E1713]'>
									<div className='flex items-center gap-2 text-body dark:text-gray-4'>
										<div className='h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent' />
										<span>
											{processingState === "transcribing" &&
												"Gnani AI se voice recognize ho rahi hai..."}
											{processingState === "querying" &&
												"Database se live room status check ho raha hai..."}
											{processingState === "speaking" && (
												<span className='flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400'>
													🔊 Speaking response...
												</span>
											)}
										</span>
									</div>

									{processingState === "speaking" && (
										<button
											onClick={stopAudioPlayback}
											className='rounded bg-red-100 px-2 py-1 text-[11px] font-bold text-red-700 transition hover:bg-red-200 dark:bg-red-950 dark:text-red-300'
										>
											⏹ Stop Audio
										</button>
									)}
								</div>
							)}

							{/* Error Alert */}
							{errorMessage && (
								<div className='rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-400'>
									<div className='flex items-start gap-2'>
										<span className='text-sm'>⚠️</span>
										<div className='flex-1 leading-relaxed'>{errorMessage}</div>
									</div>
								</div>
							)}

							<div ref={messagesEndRef} />
						</div>

						{/* Footer / Input Controls */}
						<div className='border-t border-[#E8E3D8] bg-white p-4 dark:border-slate-800 dark:bg-[#0E1713]'>
							{/* Recording State Overlay with Live Waveform & Auto-Stop */}
							{isRecording ? (
								<div className='flex flex-col items-center justify-center space-y-3 py-2'>
									<div className='flex items-center gap-2'>
										<span className='relative flex h-3 w-3'>
											<span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75'></span>
											<span className='relative inline-flex h-3 w-3 rounded-full bg-emerald-500'></span>
										</span>
										<span className='text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400'>
											{hasSpoken
												? "Sun raha hoon... Bolne ke baad apne aap send hoga"
												: "Boliye (Listening...)"}{" "}
											({recordingTime}s / {MAX_RECORDING_SECONDS}s)
										</span>
									</div>

									{/* Dynamic Soundwave Activity Indicator */}
									<div className='flex h-8 items-center gap-1.5'>
										{[0.4, 0.7, 1.0, 0.8, 0.5].map((scale, i) => (
											<span
												key={i}
												className='w-1.5 rounded-full bg-emerald-500 transition-all duration-75'
												style={{
													height: `${Math.max(6, Math.min(32, audioLevel * scale * 0.8 + 6))}px`,
												}}
											/>
										))}
									</div>

									<p className='text-center text-xs text-body dark:text-gray-4'>
										<i>&quot;Kaunse rooms khali hain?&quot;</i> ya{" "}
										<i>&quot;Room 1 ka status&quot;</i>
									</p>

									<div className='flex items-center gap-3'>
										<button
											onClick={stopRecording}
											className='flex items-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md transition hover:bg-emerald-700'
										>
											<span>✓</span> Send Now
										</button>
										<button
											onClick={cancelRecording}
											className='rounded-full border border-stroke px-4 py-2 text-xs font-medium text-body transition hover:bg-gray-100 dark:border-stroke-dark dark:text-gray-4 dark:hover:bg-slate-800'
										>
											Cancel
										</button>
									</div>
								</div>
							) : (
								<div className='space-y-3'>
									{/* Big Mic Callout Button */}
									<div className='flex items-center justify-center'>
										<button
											onClick={startRecording}
											disabled={processingState !== "idle"}
											className='group flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950'
										>
											<span className='flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white transition group-hover:scale-110'>
												<svg
													className='h-3.5 w-3.5'
													fill='none'
													stroke='currentColor'
													viewBox='0 0 24 24'
												>
													<path
														strokeLinecap='round'
														strokeLinejoin='round'
														strokeWidth='2'
														d='M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 02-3-3V5a3 3 0 116 0v6a3 3 0 02-3 3z'
													/>
												</svg>
											</span>
											<span>Tap to Speak (Voice Command)</span>
										</button>
									</div>

									{/* Typed Input Fallback (0 Gnani Credits Used) */}
									<form
										onSubmit={handleTypedSubmit}
										className='flex items-center gap-2'
									>
										<input
											type='text'
											value={typedInput}
											onChange={(e) => setTypedInput(e.target.value)}
											placeholder='Ya yahan type karein: "Room 102 mein kitne beds hain?"...'
											disabled={processingState !== "idle"}
											className='flex-1 rounded-lg border border-stroke bg-gray-1 px-3.5 py-2 text-xs text-dark placeholder:text-gray-5 focus:border-emerald-500 focus:outline-none dark:border-stroke-dark dark:bg-dark-2 dark:text-white'
										/>
										<button
											type='submit'
											disabled={
												!typedInput.trim() || processingState !== "idle"
											}
											className='flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:opacity-40'
											title='Send Typed Query (Uses 0 Credits)'
										>
											<svg
												className='h-4 w-4'
												fill='none'
												stroke='currentColor'
												viewBox='0 0 24 24'
											>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth='2'
													d='M14 5l7 7m0 0l-7 7m7-7H3'
												/>
											</svg>
										</button>
									</form>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</>
	);
}

function QueriedRoomCard({ room }: { room: RoomVacancyDetail }) {
	return (
		<div className='rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/20'>
			<div className='flex items-center justify-between font-bold text-emerald-900 dark:text-emerald-300'>
				<span>
					Room {room.roomNumber} ({room.sharing})
				</span>
				<span>{room.floor}</span>
			</div>
			<div className='mt-1 text-gray-700 dark:text-gray-300'>
				AC Type: <span className='font-medium'>{room.acType}</span>
				{room.rentPerBed && (
					<span className='ml-2 font-medium text-emerald-700 dark:text-emerald-400'>
						• {formatINR(room.rentPerBed)}/bed
					</span>
				)}
			</div>
			<div className='mt-2 flex flex-wrap gap-1'>
				{room.availableBedNumbers.map((num) => (
					<span
						key={num}
						className='rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white'
					>
						Bed #{num}
					</span>
				))}
			</div>
		</div>
	);
}

function VacantRoomsList({ rooms }: { rooms: RoomVacancyDetail[] }) {
	if (rooms.length === 0) {
		return (
			<div className='rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300'>
				⚠️ Filhal koi room ya bed available nahi hai. Pura PG occupied hai.
			</div>
		);
	}

	return (
		<div className='max-h-60 space-y-2 overflow-y-auto pr-1'>
			{rooms.map((room) => (
				<div
					key={room.roomId}
					className='rounded-lg border border-stroke bg-gray-50/50 p-2 text-xs dark:border-stroke-dark dark:bg-dark-2/40'
				>
					<div className='flex items-center justify-between'>
						<div className='font-bold text-dark dark:text-white'>
							Room {room.roomNumber}
							<span className='ml-1.5 font-normal text-body dark:text-gray-4'>
								({room.sharing}, {room.acType})
							</span>
						</div>
						<span className='rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'>
							{room.availableBedCount} / {room.totalBeds} Free
						</span>
					</div>
					<div className='mt-1 flex items-center justify-between text-[11px] text-body dark:text-gray-4'>
						<span>{room.floor}</span>
						{room.rentPerBed ? (
							<span className='font-medium text-dark dark:text-white'>
								{formatINR(room.rentPerBed)}/mo
							</span>
						) : null}
					</div>
					<div className='mt-1.5 flex flex-wrap gap-1'>
						{room.availableBedNumbers.map((bedNum) => (
							<span
								key={bedNum}
								className='rounded border border-emerald-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-dark-2 dark:text-emerald-300'
							>
								Bed #{bedNum}
							</span>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
