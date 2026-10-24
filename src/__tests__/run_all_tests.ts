/**
 * run_all_tests.ts
 *
 * Master Automated Test Suite Runner for Choose Bed & PG Saathi AI.
 * Sequentially executes all 8 domain, security, and voice test suites.
 */

import { execSync } from "child_process";
import path from "path";

interface SuiteResult {
	name: string;
	file: string;
	status: "PASS" | "FAIL";
	durationMs: number;
	output: string;
}

const TEST_SUITES = [
	{
		name: "Admin Security & Privilege Escalation",
		file: "admin_security.test.ts",
	},
	{ name: "Notifications Endpoint Security", file: "notifications.test.ts" },
	{
		name: "Owner Onboarding & Multi-Tenant Boundary",
		file: "owner_onboarding.test.ts",
	},
	{ name: "Rent Charges, Dues & Receipts", file: "rent_dues.test.ts" },
	{
		name: "Resident Allocation & Bed Invariant Locks",
		file: "residents.test.ts",
	},
	{ name: "Rooms & Beds Atomic Inventory", file: "rooms_beds.test.ts" },
	{
		name: "Authentication & Session Security Regressions",
		file: "security.test.ts",
	},
	{
		name: "PG Saathi AI Voice Intelligence & Regression Suite",
		file: "voice_room_queries.test.ts",
	},
];

async function main() {
	console.log(
		"================================================================="
	);
	console.log("Choose Bed + PG Saathi AI — Master Test Suite Verification");
	console.log(
		"=================================================================\n"
	);

	const results: SuiteResult[] = [];
	const overallStart = Date.now();

	for (const suite of TEST_SUITES) {
		process.stdout.write(`▶ Running: ${suite.name} (${suite.file})... `);
		const suiteStart = Date.now();
		const filePath = path.join(__dirname, suite.file);

		try {
			const stdout = execSync(`npx tsx "${filePath}"`, {
				cwd: path.resolve(__dirname, "../.."),
				stdio: ["ignore", "pipe", "pipe"],
				timeout: 60000,
			}).toString();

			const duration = Date.now() - suiteStart;
			console.log(`✅ PASS (${(duration / 1000).toFixed(1)}s)`);
			results.push({
				name: suite.name,
				file: suite.file,
				status: "PASS",
				durationMs: duration,
				output: stdout,
			});
		} catch (error: any) {
			const duration = Date.now() - suiteStart;
			console.log(`❌ FAIL (${(duration / 1000).toFixed(1)}s)`);
			const errOutput =
				error.stdout?.toString() || error.stderr?.toString() || error.message;
			results.push({
				name: suite.name,
				file: suite.file,
				status: "FAIL",
				durationMs: duration,
				output: errOutput,
			});
		}
	}

	const overallDuration = ((Date.now() - overallStart) / 1000).toFixed(1);
	const passCount = results.filter((r) => r.status === "PASS").length;
	const failCount = results.filter((r) => r.status === "FAIL").length;

	console.log(
		"\n================================================================="
	);
	console.log("MASTER TEST SUMMARY");
	console.log(
		"================================================================="
	);
	results.forEach((r, idx) => {
		const icon = r.status === "PASS" ? "✅" : "❌";
		console.log(
			`${icon} [${idx + 1}/${results.length}] ${r.name.padEnd(52)} (${(r.durationMs / 1000).toFixed(1)}s)`
		);
	});

	console.log(
		"-----------------------------------------------------------------"
	);
	console.log(
		`Total Suites: ${results.length} | Passed: ${passCount} | Failed: ${failCount} | Total Time: ${overallDuration}s`
	);
	console.log(
		"=================================================================\n"
	);

	if (failCount > 0) {
		console.error("Master test run failed. Inspect failure details above.");
		process.exit(1);
	}
}

main().catch((err) => {
	console.error("Test runner threw uncaught fatal exception:", err);
	process.exit(1);
});
