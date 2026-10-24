"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface QueryDemo {
	id: string;
	lang: string;
	langBadge: string;
	query: string;
	intent: string;
	response: string;
	highlightBeds: string[];
	metrics: {
		latency: string;
		detectedLang: string;
		tokens: string;
	};
}

const DEMO_QUERIES: QueryDemo[] = [
	{
		id: "ac_rooms",
		lang: "Hindi",
		langBadge: "हिंदी",
		query: "Kaunse AC room khali hain?",
		intent: "AC_ROOM_AVAILABILITY",
		response:
			"Aapke PG me filhal 2 AC rooms me vacancy hai: Room 101 (Double Sharing - Bed 2) aur Room 203 (Triple Sharing - Bed 2). Total 2 AC beds available hain.",
		highlightBeds: ["Room 101 (Bed 2)", "Room 203 (Bed 2)"],
		metrics: {
			latency: "142ms",
			detectedLang: "Hindi (hi)",
			tokens: "0 (Direct DB)",
		},
	},
	{
		id: "eng_avail",
		lang: "English",
		langBadge: "English",
		query: "Which beds are available right now?",
		intent: "AVAILABLE_BEDS",
		response:
			"You currently have 5 vacant beds across 4 rooms: Room 101 (1 bed), Room 104 (2 beds), Room 202 (1 bed), and Room 203 (1 bed). Total occupancy is at 72%.",
		highlightBeds: ["Room 101", "Room 104", "Room 202", "Room 203"],
		metrics: {
			latency: "128ms",
			detectedLang: "English (en)",
			tokens: "0 (Direct DB)",
		},
	},
	{
		id: "guj_beds",
		lang: "Gujarati",
		langBadge: "ગુજરાતી",
		query: "Total ketla bed khali che?",
		intent: "AVAILABLE_BEDS",
		response:
			"તમારા PG માં હાલમાં કુલ 5 બેડ ખાલી છે (2 AC બેડ અને 3 Non-AC બેડ). 13 બેડ ભરેલા છે.",
		highlightBeds: ["5 Beds Vacant", "13 Occupied"],
		metrics: {
			latency: "156ms",
			detectedLang: "Gujarati (gu)",
			tokens: "0 (Direct DB)",
		},
	},
	{
		id: "dues_pending",
		lang: "Rent & Dues",
		langBadge: "Ledger",
		query: "Kiska rent payment baki hai?",
		intent: "PAYMENT_HISTORY_OR_DUES",
		response:
			"Is mahine 2 residents ka rent pending hai: Room 102 me Amit Kumar (₹6,000) aur Room 204 me Aditya Roy (₹6,500). Total pending dues: ₹12,500.",
		highlightBeds: ["Amit Kumar (₹6,000)", "Aditya Roy (₹6,500)"],
		metrics: {
			latency: "135ms",
			detectedLang: "Hinglish (hi-en)",
			tokens: "0 (Ledger Query)",
		},
	},
];

export function HeroVoiceWidget() {
	const [selectedQuery, setSelectedQuery] = useState<QueryDemo>(DEMO_QUERIES[0]);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isSpeakingTTS, setIsSpeakingTTS] = useState(false);

	// Handle speech synthesis for real interactive voice demo
	const speakResponse = (text: string, lang: string) => {
		if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
		try {
			window.speechSynthesis.cancel();
			const utterance = new SpeechSynthesisUtterance(text);
			utterance.rate = 1.0;
			utterance.pitch = 1.0;
			if (lang === "Gujarati") {
				utterance.lang = "gu-IN";
			} else if (lang === "Hindi" || lang === "Rent & Dues") {
				utterance.lang = "hi-IN";
			} else {
				utterance.lang = "en-IN";
			}

			utterance.onstart = () => setIsSpeakingTTS(true);
			utterance.onend = () => setIsSpeakingTTS(false);
			utterance.onerror = () => setIsSpeakingTTS(false);

			window.speechSynthesis.speak(utterance);
		} catch (e) {
			console.error("Speech synthesis error", e);
			setIsSpeakingTTS(false);
		}
	};

	const handleSelectQuery = (demo: QueryDemo) => {
		setSelectedQuery(demo);
		setIsPlaying(true);
		if (typeof window !== "undefined" && "speechSynthesis" in window) {
			window.speechSynthesis.cancel();
			setIsSpeakingTTS(false);
		}
	};

	// Clean up speech on unmount
	useEffect(() => {
		return () => {
			if (typeof window !== "undefined" && "speechSynthesis" in window) {
				window.speechSynthesis.cancel();
			}
		};
	}, []);

	return (
		<div className='relative mx-auto mt-10 w-full max-w-4xl overflow-hidden rounded-2xl border border-[#E8E3D8] bg-white/90 p-5 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-emerald-500/50 hover:shadow-2xl dark:border-slate-800 dark:bg-[#111F18]/90 sm:p-7'>
			{/* Decorative ambient glow */}
			<div className='pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl' />
			<div className='pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl' />

			{/* Widget Top Bar */}
			<div className='relative flex flex-col justify-between gap-3 border-b border-[#F0EBE0] pb-4 dark:border-slate-800 sm:flex-row sm:items-center'>
				<div className='flex items-center gap-3'>
					<div className='relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-[#0B2B20] text-white shadow-md shadow-emerald-950/20'>
						<span className='text-lg'>🎙️</span>
						<span className='absolute -top-1 -right-1 flex h-3 w-3'>
							<span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75' />
							<span className='relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900' />
						</span>
					</div>
					<div>
						<div className='flex items-center gap-2'>
							<h3 className='font-inter text-sm font-bold text-[#0B2B20] dark:text-white sm:text-base'>
								PG Saathi AI — Voice Copilot
							</h3>
							<span className='rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'>
								Live Demo
							</span>
						</div>
						<p className='text-xs text-[#5A6560] dark:text-slate-400'>
							Speak naturally in Hindi, English, Gujarati or Hinglish
						</p>
					</div>
				</div>

				{/* Auto Language Detection Pill */}
				<div className='flex items-center gap-2 self-start sm:self-auto'>
					<span className='inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'>
						<span className='h-1.5 w-1.5 rounded-full bg-emerald-500' />
						Auto-Language Detect Active
					</span>
				</div>
			</div>

			{/* Interactive Query Chips */}
			<div className='relative mt-4'>
				<p className='text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
					Tap a voice query to test instant AI response:
				</p>
				<div className='mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4'>
					{DEMO_QUERIES.map((demo) => {
						const isSelected = selectedQuery.id === demo.id;
						return (
							<button
								key={demo.id}
								onClick={() => handleSelectQuery(demo)}
								className={`group relative flex flex-col items-start rounded-xl border p-3 text-left transition-all duration-200 ${
									isSelected
										? "border-emerald-600 bg-emerald-50/80 shadow-md ring-2 ring-emerald-600/20 dark:border-emerald-500 dark:bg-emerald-950/40"
										: "border-[#E8E3D8] bg-[#FAF8F5] hover:border-emerald-400 hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-900"
								}`}
							>
								<div className='flex w-full items-center justify-between'>
									<span
										className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
											isSelected
												? "bg-emerald-700 text-white dark:bg-emerald-600"
												: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
										}`}
									>
										{demo.langBadge}
									</span>
									<span className='text-xs opacity-70 group-hover:scale-110 transition-transform'>
										🗣️
									</span>
								</div>
								<p
									className={`mt-2 font-medium text-xs leading-snug line-clamp-2 ${
										isSelected
											? "font-bold text-[#0B2B20] dark:text-white"
											: "text-slate-700 dark:text-slate-300"
									}`}
								>
									&ldquo;{demo.query}&rdquo;
								</p>
							</button>
						);
					})}
				</div>
			</div>

			{/* Live Voice Interaction Window */}
			<div className='relative mt-5 rounded-xl border border-[#E8E3D8] bg-[#FAF8F5] p-4 dark:border-slate-800 dark:bg-[#0B1712] sm:p-5'>
				{/* Simulated Voice Waveform & Input */}
				<div className='flex flex-wrap items-center justify-between gap-3 border-b border-[#F0EBE0] pb-3 dark:border-slate-800/80'>
					<div className='flex items-center gap-2'>
						<span className='flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'>
							🎤
						</span>
						<div>
							<span className='text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
								Owner Voice Input:
							</span>
							<p className='text-sm font-bold text-[#0B2B20] dark:text-emerald-400'>
								&ldquo;{selectedQuery.query}&rdquo;
							</p>
						</div>
					</div>

					{/* Active Voice Wave Animation */}
					<div className='flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-2xs dark:bg-slate-900'>
						<span className='text-[10px] font-semibold text-slate-500 dark:text-slate-400'>
							VAD Audio
						</span>
						<div className='flex items-center gap-0.5 h-4'>
							<span className='h-2.5 w-1 rounded-full bg-emerald-500 animate-[pulse_0.6s_ease-in-out_infinite]' />
							<span className='h-4 w-1 rounded-full bg-emerald-600 animate-[pulse_0.4s_ease-in-out_infinite]' />
							<span className='h-3 w-1 rounded-full bg-amber-500 animate-[pulse_0.7s_ease-in-out_infinite]' />
							<span className='h-5 w-1 rounded-full bg-emerald-500 animate-[pulse_0.5s_ease-in-out_infinite]' />
							<span className='h-2 w-1 rounded-full bg-emerald-600 animate-[pulse_0.8s_ease-in-out_infinite]' />
						</div>
					</div>
				</div>

				{/* AI Voice Assistant Response */}
				<div className='mt-3.5'>
					<div className='flex items-center justify-between'>
						<div className='flex items-center gap-2'>
							<span className='flex h-6 w-6 items-center justify-center rounded-full bg-[#0B2B20] text-[11px] text-[#E5A83B] dark:bg-emerald-900 dark:text-emerald-300'>
								🤖
							</span>
							<span className='text-xs font-bold text-[#0B2B20] dark:text-white'>
								PG Saathi Response
							</span>
						</div>

						{/* Audio Play Button */}
						<button
							onClick={() =>
								speakResponse(selectedQuery.response, selectedQuery.lang)
							}
							className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-bold shadow-2xs transition-all ${
								isSpeakingTTS
									? "border-emerald-600 bg-emerald-600 text-white animate-pulse"
									: "border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800"
							}`}
						>
							<span>{isSpeakingTTS ? "🔊 Speaking..." : "🔊 Listen Voice"}</span>
						</button>
					</div>

					<p className='mt-2.5 rounded-lg bg-white p-3.5 text-xs sm:text-sm leading-relaxed text-[#2D3732] shadow-2xs dark:bg-slate-900 dark:text-slate-200'>
						{selectedQuery.response}
					</p>

					{/* Grounded Database Findings */}
					<div className='mt-3 flex flex-wrap items-center gap-2'>
						<span className='text-[11px] font-semibold text-slate-500 dark:text-slate-400'>
							Grounded Database Entities:
						</span>
						{selectedQuery.highlightBeds.map((bed, idx) => (
							<span
								key={idx}
								className='inline-flex items-center gap-1 rounded-md border border-emerald-300/80 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
							>
								<span className='h-1.5 w-1.5 rounded-full bg-emerald-500' />
								{bed}
							</span>
						))}
					</div>

					{/* Production Safeguard Metrics */}
					<div className='mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#F0EBE0] pt-2.5 text-[11px] text-slate-500 dark:border-slate-800/80 dark:text-slate-400'>
						<div className='flex items-center gap-3'>
							<span>
								Latency: <strong className='text-emerald-700 dark:text-emerald-400'>{selectedQuery.metrics.latency}</strong>
							</span>
							<span>•</span>
							<span>
								STT: <strong className='text-slate-700 dark:text-slate-300'>{selectedQuery.metrics.detectedLang}</strong>
							</span>
							<span>•</span>
							<span>
								Cost: <strong className='text-emerald-700 dark:text-emerald-400'>{selectedQuery.metrics.tokens}</strong>
							</span>
						</div>
						<span className='text-[10px] font-semibold text-slate-400'>
							Read-Only Safe • Zero Accidental Deletions
						</span>
					</div>
				</div>
			</div>

			{/* Bottom Link to Full Voice Section */}
			<div className='mt-4 flex flex-col items-center justify-between gap-2 sm:flex-row'>
				<span className='text-xs text-[#5A6560] dark:text-slate-400'>
					Want to ask your own custom question using your microphone?
				</span>
				<a
					href='#voice-copilot'
					className='inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 dark:text-emerald-300 dark:hover:text-emerald-200'
				>
					<span>Explore Full Voice Copilot Section</span>
					<span>↓</span>
				</a>
			</div>
		</div>
	);
}
