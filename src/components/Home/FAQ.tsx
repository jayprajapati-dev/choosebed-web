"use client";

import Link from "next/link";
import React, { useState } from "react";

const faqs = [
	{
		q: "Do residents or students need to download an app or sign up?",
		a: "No. ChooseBed is strictly an owner management tool. You or your property manager record resident details and assign rooms directly. Residents do not need to download an app or create an account.",
	},
	{
		q: "Can I use ChooseBed for hostels and co-living spaces?",
		a: "Yes. Whether you operate a 10-bed student PG, a 150-bed hostel, or a co-living property, ChooseBed allows you to customize floors, AC and Non-AC rooms, and sharing types easily.",
	},
	{
		q: "Can I configure AC and Non-AC rooms with different sharing types?",
		a: "Yes. You can easily mark rooms as AC or Non-AC, choose sharing capacity (Single, Double, Triple sharing), and track occupied and empty beds with complete ease.",
	},
	{
		q: "Can I check empty beds on my mobile phone?",
		a: "Yes. ChooseBed works smoothly on mobile phones and tablets. You can check vacant beds or add a new resident directly from your phone browser while walking through your PG.",
	},
	{
		q: "What is PG Saathi AI and which languages does it support?",
		a: "PG Saathi AI is a built-in voice copilot for property owners. It supports natural spoken queries in Hindi, Indian English, Gujarati, and Hinglish. You can ask questions like 'Kaunse room khali hain?', 'Which bed is available?', or 'Kiska payment baki hai?' and get instant live answers.",
	},
	{
		q: "Does PG Saathi AI cost extra or consume expensive AI credits?",
		a: "No. Standard operational queries for vacant rooms, empty beds, room tariffs, and resident dues resolve locally in 0ms with zero LLM token cost using our deterministic Indic NLU engine.",
	},
	{
		q: "Can I manage more than one PG from the same owner account?",
		a: "Yes. Your owner account allows you to add and manage multiple properties or branches, each with its own floors, rooms, and resident records.",
	},
];

const FAQ = () => {
	const [openIndex, setOpenIndex] = useState<number | null>(0);

	const toggle = (idx: number) => {
		setOpenIndex(openIndex === idx ? null : idx);
	};

	return (
		<section
			id='faq'
			className='border-t border-[#E8E3D8] bg-[#FBF9F5] py-20 dark:border-slate-800 dark:bg-[#0E1713] sm:py-28'
		>
			<div className='mx-auto max-w-[1170px] px-4 sm:px-8 xl:px-0'>
				<div className='grid grid-cols-1 gap-12 lg:grid-cols-12'>
					{/* Left Column: Heading and Context */}
					<div className='lg:col-span-5'>
						<span className='rounded-full border border-[#E8E3D8] bg-white px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#0B2B20] dark:border-slate-800 dark:bg-slate-900 dark:text-emerald-300'>
							Common Questions
						</span>
						<h2 className='mt-4 font-inter text-3xl font-extrabold tracking-tight text-[#0B2B20] dark:text-white sm:text-4xl'>
							Frequently asked{" "}
							<span className='font-serif font-normal italic text-[#1A533F] dark:text-[#34D399]'>
								owner questions.
							</span>
						</h2>
						<p className='mt-3 text-sm leading-relaxed text-[#4A5550] dark:text-slate-300 sm:text-base'>
							Simple answers to the most common questions Indian PG, hostel, and
							co-living owners ask.
						</p>

						<div className='mt-8 rounded-2xl border border-[#E8E3D8] bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900'>
							<h4 className='text-sm font-bold text-[#0B2B20] dark:text-white'>
								Ready to get your PG organized?
							</h4>
							<p className='mt-1 text-xs text-[#4A5550] dark:text-slate-400'>
								Create your owner account in 60 seconds and set up your floors
								and rooms.
							</p>
							<div className='mt-4'>
								<Link
									href='/auth/signup'
									className='inline-flex items-center gap-1.5 rounded-xl bg-[#0B2B20] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#133E2F] dark:bg-white dark:text-[#0B2B20]'
								>
									<span>Register Your PG</span>
									<span>→</span>
								</Link>
							</div>
						</div>
					</div>

					{/* Right Column: 5 Focused Accordions */}
					<div className='space-y-3.5 lg:col-span-7'>
						{faqs.map((faq, idx) => {
							const isOpen = openIndex === idx;
							return (
								<div
									key={idx}
									className={`overflow-hidden rounded-xl border transition-all ${
										isOpen
											? "border-[#0B2B20] bg-white shadow-sm ring-1 ring-[#0B2B20]/10 dark:border-emerald-600 dark:bg-slate-900"
											: "border-[#E8E3D8] bg-white hover:border-[#D5CEBF] dark:border-slate-800 dark:bg-slate-900"
									}`}
								>
									<button
										onClick={() => toggle(idx)}
										className='flex w-full items-center justify-between p-5 text-left text-sm font-bold text-[#0B2B20] dark:text-white sm:text-base'
										aria-expanded={isOpen}
									>
										<span>{faq.q}</span>
										<span
											className={`ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
												isOpen
													? "bg-[#0B2B20] text-white dark:bg-emerald-700"
													: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
											}`}
										>
											{isOpen ? "−" : "+"}
										</span>
									</button>
									{isOpen && (
										<div className='border-t border-[#F0EBE0] p-5 pt-3 text-sm leading-relaxed text-[#4A5550] dark:border-slate-800 dark:text-slate-300'>
											{faq.a}
										</div>
									)}
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</section>
	);
};

export default FAQ;
