"use client";

import React, { useState } from "react";

interface SampleQuery {
	id: string;
	tabLabel: string;
	queryText: string;
	detectedLang: string;
	responseAudioText: string;
	metrics: {
		latency: string;
		tokens: string;
		accuracy: string;
	};
	card: {
		title: string;
		subtitle: string;
		badge: string;
		badgeColor: string;
		details: Array<{ label: string; value: string }>;
	};
}

const SAMPLE_QUERIES: SampleQuery[] = [
	{
		id: "en-vacant",
		tabLabel: "English: Bed Vacancy",
		queryText: "Which bed is available?",
		detectedLang: "Auto-Detected: English",
		responseAudioText:
			"In your PG 'Sunrise Residency', a total of 4 bed(s) are available across 2 room(s): Room 101 (1 bed free), Room 103 (2 beds free).",
		metrics: {
			latency: "0 ms (Local Regex)",
			tokens: "0 Tokens Consumed",
			accuracy: "100% Grounded in DB",
		},
		card: {
			title: "Room 101 & 103 Availability",
			subtitle: "Sunrise Residency • 1st Floor",
			badge: "4 Beds Available",
			badgeColor:
				"bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
			details: [
				{ label: "Room 101 (Triple, AC)", value: "Bed #3 Free • ₹7,500/mo" },
				{
					label: "Room 103 (Double, Non-AC)",
					value: "Bed #1 & #2 Free • ₹5,000/mo",
				},
				{ label: "Occupancy Rate", value: "78% (14 / 18 Beds Occupied)" },
			],
		},
	},
	{
		id: "hi-rooms",
		tabLabel: "हिन्दी / Hinglish",
		queryText: "Kaunse room khali hain?",
		detectedLang: "Auto-Detected: Hindi / Hinglish",
		responseAudioText:
			"Aapke PG 'Sunrise Residency' mein 2 rooms mein beds khali hain: Room 101 (1 bed) aur Room 103 (2 beds). Kul 4 beds available hain.",
		metrics: {
			latency: "0 ms (Local Regex)",
			tokens: "0 Tokens Consumed",
			accuracy: "100% Grounded in DB",
		},
		card: {
			title: "Khali Rooms Status",
			subtitle: "Real-Time Inventory Rollup",
			badge: "2 Rooms Vacant",
			badgeColor:
				"bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
			details: [
				{ label: "Room 101", value: "1 / 3 Free (Triple, AC) • ₹7,500/mo" },
				{ label: "Room 103", value: "2 / 2 Free (Double, Non-AC) • ₹5,000/mo" },
				{ label: "Next Action", value: "Tap to assign walk-in resident" },
			],
		},
	},
	{
		id: "gu-rooms",
		tabLabel: "ગુજરાતી (Gujarati)",
		queryText: "કયા રૂમ ખાલી છે?",
		detectedLang: "Auto-Detected: Gujarati",
		responseAudioText:
			"તમારા પીજી 'Sunrise Residency' માં 2 રૂમમાં બેડ ખાલી છે: Room 101 (1 બેડ) અને Room 103 (2 બેડ). કુલ 4 બેડ ખાલી છે.",
		metrics: {
			latency: "0 ms (Local Regex)",
			tokens: "0 Tokens Consumed",
			accuracy: "100% Grounded in DB",
		},
		card: {
			title: "ખાલી રૂમની વિગત",
			subtitle: "લાઇવ પીજી ઇન્વેન્ટરી",
			badge: "4 બેડ ખાલી",
			badgeColor:
				"bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
			details: [
				{ label: "રૂમ ૧૦૧", value: "૧ બેડ ખાલી (એસી) • ₹૭,૫૦૦/માસ" },
				{ label: "રૂમ ૧૦૩", value: "૨ બેડ ખાલી (નોન-એસી) • ₹૫,૦૦૦/માસ" },
				{ label: "સ્થિતિ", value: "તરત જ પ્રવેશ આપી શકાય છે" },
			],
		},
	},
	{
		id: "dues-ledger",
		tabLabel: "Ledger: Dues Check",
		queryText: "Kiska payment baki hai?",
		detectedLang: "Auto-Detected: Hinglish (Ledger Query)",
		responseAudioText:
			"Aapke PG mein 2 residents ka rent baki hai: Rahul Sharma (Room 101) - ₹2,500 aur Amit Patel (Room 102) - ₹5,000. Kul ₹7,500 pending hai.",
		metrics: {
			latency: "4 ms (Database Join)",
			tokens: "0 Tokens Consumed",
			accuracy: "Live Ledger Computation",
		},
		card: {
			title: "Pending Rent Ledger Breakdown",
			subtitle: "October 2026 Billing Period",
			badge: "₹7,500 Total Pending",
			badgeColor:
				"bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
			details: [
				{
					label: "Rahul Sharma (Room 101)",
					value: "₹2,500 Pending (₹5,000 Paid)",
				},
				{ label: "Amit Patel (Room 102)", value: "₹5,000 Pending (₹0 Paid)" },
				{
					label: "Total Collected This Month",
					value: "₹62,500 (89% Collection Rate)",
				},
			],
		},
	},
	{
		id: "ac-filter",
		tabLabel: "AC Filter: Accurate Check",
		queryText: "Koi AC wala room khali hai?",
		detectedLang: "Auto-Detected: Hindi (AC Constraint)",
		responseAudioText:
			"Haan, aapke PG mein Room 101 (Triple, AC) mein 1 bed khali hai. Monthly rent ₹7,500 hai.",
		metrics: {
			latency: "0 ms (Constraint Matcher)",
			tokens: "0 Tokens Consumed",
			accuracy: "Strict AC Isolation",
		},
		card: {
			title: "AC Room Vacancy Filter",
			subtitle: "Strict AC Constraint Active",
			badge: "AC Only (Room 101)",
			badgeColor:
				"bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
			details: [
				{ label: "Selected Room", value: "Room 101 (AC, 1st Floor)" },
				{ label: "Free Bed", value: "Bed #3 (Occupancy: 2/3)" },
				{ label: "Non-AC Filter", value: "Non-AC rooms strictly excluded" },
			],
		},
	},
];

export default function PGSaathiShowcase() {
	const [activeQueryIndex, setActiveQueryIndex] = useState(0);
	const active = SAMPLE_QUERIES[activeQueryIndex];

	return (
		<section
			id='voice-copilot'
			className='relative overflow-hidden border-t border-[#E8E3D8] bg-[#F7F4EE] py-20 dark:border-slate-800 dark:bg-[#07130E] sm:py-28'
		>
			{/* Ambient Gradient Glow */}
			<div className='pointer-events-none absolute left-1/2 top-0 h-96 w-full max-w-6xl -translate-x-1/2 bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent blur-3xl dark:from-emerald-900/20' />

			<div className='relative mx-auto max-w-[1170px] px-4 sm:px-8 xl:px-0'>
				{/* Section Header */}
				<div className='mx-auto max-w-3xl text-center'>
					<div className='inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-1.5 text-xs font-semibold text-[#0B2B20] shadow-sm dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300'>
						<span className='relative flex h-2.5 w-2.5'>
							<span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75' />
							<span className='relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500' />
						</span>
						<span className='text-[11px] font-bold uppercase tracking-wider'>
							Built-in Voice Copilot
						</span>
					</div>

					<h2 className='mt-5 font-inter text-3xl font-extrabold tracking-tight text-[#0B2B20] dark:text-white sm:text-5xl'>
						Meet{" "}
						<span className='font-serif italic text-emerald-800 dark:text-emerald-400'>
							PG Saathi AI
						</span>
					</h2>

					<p className='mt-4 text-base leading-relaxed text-[#4A5550] dark:text-slate-300 sm:text-lg'>
						Speak naturally in <strong>Hindi, English, or Gujarati</strong>. PG
						Saathi instantly checks room vacancies, bed counts, rent rates, and
						tenant dues directly from your live database with{" "}
						<strong>zero token cost</strong> on standard queries.
					</p>
				</div>

				{/* Interactive Query Tabs */}
				<div className='mt-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3'>
					{SAMPLE_QUERIES.map((q, idx) => {
						const isSelected = activeQueryIndex === idx;
						return (
							<button
								key={q.id}
								onClick={() => setActiveQueryIndex(idx)}
								className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all sm:text-sm ${
									isSelected
										? "bg-[#0B2B20] text-white shadow-md ring-2 ring-[#0B2B20] dark:bg-emerald-500 dark:text-[#0B2B20] dark:ring-emerald-400"
										: "border border-[#E8E3D8] bg-white text-[#4A5550] hover:border-[#133E2F] hover:text-[#0B2B20] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700"
								}`}
							>
								<span>🎤</span>
								<span>{q.tabLabel}</span>
							</button>
						);
					})}
				</div>

				{/* Interactive Interactive Preview Container */}
				<div className='mt-8 rounded-3xl border border-[#E8E3D8] bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-[#0C1A14] sm:p-10'>
					<div className='grid grid-cols-1 items-center gap-8 lg:grid-cols-12'>
						{/* Left Column: Conversational Voice Turn */}
						<div className='space-y-6 lg:col-span-7'>
							{/* Owner Voice Utterance */}
							<div className='flex items-start gap-3.5'>
								<div className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'>
									👤
								</div>
								<div className='shadow-xs flex-1 rounded-2xl rounded-tl-sm border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-950 dark:bg-emerald-950/30'>
									<div className='flex items-center justify-between gap-2'>
										<span className='text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400'>
											Owner Spoken Voice
										</span>
										<span className='shadow-2xs rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300'>
											{active.detectedLang}
										</span>
									</div>
									<p className='mt-1.5 text-lg font-bold text-slate-900 dark:text-white'>
										&ldquo;{active.queryText}&rdquo;
									</p>
								</div>
							</div>

							{/* Soundwave Animation Strip */}
							<div className='flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/60'>
								<div className='flex items-center gap-1'>
									<span className='inline-block h-4 w-1 animate-pulse rounded-full bg-emerald-500' />
									<span
										className='inline-block h-6 w-1 animate-pulse rounded-full bg-emerald-600'
										style={{ animationDelay: "150ms" }}
									/>
									<span
										className='inline-block h-3 w-1 animate-pulse rounded-full bg-emerald-400'
										style={{ animationDelay: "300ms" }}
									/>
									<span
										className='inline-block h-5 w-1 animate-pulse rounded-full bg-emerald-500'
										style={{ animationDelay: "450ms" }}
									/>
									<span
										className='inline-block h-2 w-1 animate-pulse rounded-full bg-emerald-400'
										style={{ animationDelay: "200ms" }}
									/>
								</div>
								<span className='text-xs font-medium text-slate-500 dark:text-slate-400'>
									Voice Activity Detection (VAD) • 16kHz Uncompressed Audio
									Stream
								</span>
							</div>

							{/* PG Saathi Response */}
							<div className='flex items-start gap-3.5'>
								<div className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#0B2B20] text-base font-bold text-white shadow-sm dark:bg-emerald-500 dark:text-[#0B2B20]'>
									🤖
								</div>
								<div className='flex-1 rounded-2xl rounded-tl-sm border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900'>
									<div className='flex items-center justify-between gap-2'>
										<span className='text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400'>
											PG Saathi Audio Reply
										</span>
										<span className='flex items-center gap-1 text-xs text-slate-400'>
											<span>🔊</span> Spoken &amp; Typed
										</span>
									</div>
									<p className='mt-1.5 text-sm leading-relaxed text-slate-800 dark:text-slate-200'>
										{active.responseAudioText}
									</p>
								</div>
							</div>

							{/* Low-Cost Architecture Metrics */}
							<div className='grid grid-cols-3 gap-2 pt-2'>
								<div className='rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-center dark:border-slate-800 dark:bg-slate-900/50'>
									<div className='text-[10px] font-semibold uppercase text-slate-400'>
										Engine Latency
									</div>
									<div className='mt-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400'>
										{active.metrics.latency}
									</div>
								</div>
								<div className='rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-center dark:border-slate-800 dark:bg-slate-900/50'>
									<div className='text-[10px] font-semibold uppercase text-slate-400'>
										Inference Cost
									</div>
									<div className='mt-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400'>
										{active.metrics.tokens}
									</div>
								</div>
								<div className='rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-center dark:border-slate-800 dark:bg-slate-900/50'>
									<div className='text-[10px] font-semibold uppercase text-slate-400'>
										Grounding
									</div>
									<div className='mt-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400'>
										{active.metrics.accuracy}
									</div>
								</div>
							</div>
						</div>

						{/* Right Column: Database Grounded Card Output */}
						<div className='lg:col-span-5'>
							<div className='rounded-2xl border-2 border-emerald-600/30 bg-gradient-to-br from-emerald-50/30 to-white p-5 shadow-lg dark:border-emerald-500/30 dark:from-emerald-950/20 dark:to-slate-900 sm:p-6'>
								<div className='flex items-center justify-between'>
									<span className='text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
										Live Database Card
									</span>
									<span
										className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${active.card.badgeColor}`}
									>
										{active.card.badge}
									</span>
								</div>

								<h3 className='mt-3 text-lg font-bold text-[#0B2B20] dark:text-white'>
									{active.card.title}
								</h3>
								<p className='text-xs text-slate-500 dark:text-slate-400'>
									{active.card.subtitle}
								</p>

								<div className='shadow-2xs mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white p-3 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900'>
									{active.card.details.map((d, i) => (
										<div
											key={i}
											className='flex items-center justify-between py-2 text-xs first:pt-0 last:pb-0'
										>
											<span className='font-medium text-slate-500 dark:text-slate-400'>
												{d.label}
											</span>
											<span className='font-bold text-slate-900 dark:text-white'>
												{d.value}
											</span>
										</div>
									))}
								</div>

								<div className='mt-5 flex items-center justify-between border-t border-slate-200/60 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400'>
									<span className='flex items-center gap-1.5'>
										<span className='size-2 rounded-full bg-emerald-500' />
										<span>PostgreSQL Grounded</span>
									</span>
									<span className='font-mono text-[10px]'>ownerId: scoped</span>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* 3 Core Architecture Pillars */}
				<div className='mt-12 grid grid-cols-1 gap-6 md:grid-cols-3'>
					<div className='shadow-xs rounded-2xl border border-[#E8E3D8] bg-white p-6 dark:border-slate-800 dark:bg-slate-900'>
						<div className='text-2xl'>⚡</div>
						<h3 className='mt-3 text-base font-bold text-[#0B2B20] dark:text-white'>
							0ms Latency on 95%+ Queries
						</h3>
						<p className='mt-2 text-xs leading-relaxed text-[#4A5550] dark:text-slate-400'>
							Standard queries for vacant rooms, empty beds, and rent rates
							resolve locally using our deterministic Indic NLU parser without
							waiting for remote LLMs.
						</p>
					</div>

					<div className='shadow-xs rounded-2xl border border-[#E8E3D8] bg-white p-6 dark:border-slate-800 dark:bg-slate-900'>
						<div className='text-2xl'>🔒</div>
						<h3 className='mt-3 text-base font-bold text-[#0B2B20] dark:text-white'>
							Strict Read-Only Safety Policy
						</h3>
						<p className='mt-2 text-xs leading-relaxed text-[#4A5550] dark:text-slate-400'>
							Voice commands can never mutate database records. Financial and
							resident actions provide guidance directing owners to
							authenticated dashboard screens.
						</p>
					</div>

					<div className='shadow-xs rounded-2xl border border-[#E8E3D8] bg-white p-6 dark:border-slate-800 dark:bg-slate-900'>
						<div className='text-2xl'>🇮🇳</div>
						<h3 className='mt-3 text-base font-bold text-[#0B2B20] dark:text-white'>
							Multilingual Auto-Detection
						</h3>
						<p className='mt-2 text-xs leading-relaxed text-[#4A5550] dark:text-slate-400'>
							Speak freely in English, Hindi, Devanagari, or Gujarati. Our
							speech engine auto-detects your language without forcing awkward
							manual settings.
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
