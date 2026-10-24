import { BrandLogo } from "@/components/Common/BrandLogo";
import Link from "next/link";
import React from "react";

const Footer = () => {
	const currentYear = new Date().getFullYear();

	return (
		<footer className='mt-auto border-t border-[#183A2E] bg-[#0D221A] py-14 text-slate-300 dark:border-slate-800 dark:bg-[#071711] sm:py-16'>
			<div className='mx-auto max-w-[1170px] px-4 sm:px-8 xl:px-0'>
				<div className='grid grid-cols-1 gap-10 md:grid-cols-4 lg:gap-12'>
					{/* Brand Column */}
					<div className='md:col-span-2'>
						<div className='flex items-center text-white'>
							<BrandLogo themeMode='dark' />
						</div>
						<p className='mt-4 max-w-sm text-sm leading-relaxed text-slate-400'>
							Choose Bed (choosebed.com) is India&apos;s dedicated PG and hostel
							management platform. Seamlessly organize properties, allocate
							rooms and beds, maintain verified resident records, and maximize
							occupancy across single and multi-branch locations.
						</p>
						<div className='mt-6 flex items-center gap-2 text-xs text-slate-400'>
							<span className='h-2 w-2 rounded-full bg-emerald-500' />
							<span>
								Trusted software for Indian PG, hostel &amp; co-living operators
							</span>
						</div>
					</div>

					{/* Navigation Links */}
					<div>
						<h4 className='text-xs font-bold uppercase tracking-wider text-[#E5A83B]'>
							Product
						</h4>
						<ul className='mt-4 space-y-2.5 text-sm'>
							<li>
								<Link
									href='/#features'
									className='transition-colors hover:text-[#E5A83B]'
								>
									Features
								</Link>
							</li>
							<li>
								<Link
									href='/#voice-copilot'
									className='transition-colors hover:text-[#E5A83B]'
								>
									PG Saathi AI 🎙️
								</Link>
							</li>
							<li>
								<Link
									href='/#how-it-works'
									className='transition-colors hover:text-[#E5A83B]'
								>
									How It Works
								</Link>
							</li>
							<li>
								<Link
									href='/#faq'
									className='transition-colors hover:text-[#E5A83B]'
								>
									FAQ
								</Link>
							</li>
							<li>
								<Link
									href='/support'
									className='transition-colors hover:text-[#E5A83B]'
								>
									Support
								</Link>
							</li>
						</ul>
					</div>

					{/* Access Links */}
					<div>
						<h4 className='text-xs font-bold uppercase tracking-wider text-[#E5A83B]'>
							Owner Account
						</h4>
						<ul className='mt-4 space-y-2.5 text-sm'>
							<li>
								<Link
									href='/auth/signin'
									className='transition-colors hover:text-[#E5A83B]'
								>
									Sign In
								</Link>
							</li>
							<li>
								<Link
									href='/auth/signup'
									className='transition-colors hover:text-[#E5A83B]'
								>
									Register Your PG
								</Link>
							</li>
							<li>
								<Link
									href='/user'
									className='transition-colors hover:text-[#E5A83B]'
								>
									Owner Dashboard
								</Link>
							</li>
							<li>
								<Link
									href='/user/account-settings'
									className='transition-colors hover:text-[#E5A83B]'
								>
									Account Settings
								</Link>
							</li>
						</ul>
					</div>
				</div>

				{/* Bottom Bar */}
				<div className='mt-12 flex flex-col items-center justify-between gap-3 border-t border-[#183A2E] pt-6 text-xs text-slate-400 sm:flex-row'>
					<p>© {currentYear} ChooseBed.com. All rights reserved.</p>
					<p>
						Simple and transparent management for Indian hostel & PG owners.
					</p>
				</div>
			</div>
		</footer>
	);
};

export default Footer;
