/*
 * Force the theme's `@custom` settings for the length of a run, and put them back.
 *
 * A Layout is a setting rather than a URL — `/tags/` is one address that renders two drawings
 * depending on `directory_layout` — so every run that sweeps the theme has to drive the settings
 * itself: group the Surfaces by the settings they need, apply each group, do the work, restore.
 * Three callers need exactly that (the score run, the width audit, the Day-one capture), and it
 * lived twice before this file existed.
 *
 * THE ORIGINAL VALUES ARE REMEMBERED ONCE, on first sight, so a run that applies three groups in
 * sequence restores what the publication had before the run rather than what the second group left
 * behind.
 *
 * A KEY THE THEME DOES NOT DECLARE IS A FAILURE, not a no-op. Ghost stores a value written before
 * an option was renamed, so a silent write would leave the run reporting a Layout it never rendered.
 */
import { api } from './admin.mjs';

/** Original values, keyed by setting, captured the first time each one is forced. */
const original = {};

/**
 * Force `values` and prove each one landed.
 *
 * One batched PUT rather than one per key: Ghost answers with the whole set, so a single round trip
 * both writes and verifies.
 */
export async function applyThemeSettings(values) {
	const entries = Object.entries(values);
	if (!entries.length) {
		return;
	}

	const before = await api('GET', '/custom_theme_settings/');
	const current = Object.fromEntries(before.custom_theme_settings.map((entry) => [entry.key, entry.value]));

	for (const [key] of entries) {
		if (!(key in current)) {
			throw new Error(`the theme declares no @custom.${key}, so this run cannot select that Layout`);
		}
		if (!(key in original)) {
			original[key] = current[key];
		}
	}

	const after = await api('PUT', '/custom_theme_settings/', {
		custom_theme_settings: entries.map(([key, value]) => ({ key, value })),
	});
	const written = Object.fromEntries(after.custom_theme_settings.map((entry) => [entry.key, entry.value]));

	for (const [key, value] of entries) {
		if (written[key] !== value) {
			throw new Error(`${key} came back as ${JSON.stringify(written[key])}, not ${JSON.stringify(value)}`);
		}
	}
}

/**
 * Put every forced value back, and report rather than throw.
 *
 * Callers run this in a `finally`, where a throw would replace the failure that brought the run
 * there — and where a half-restore would leave the live publication mutated by a harness whose
 * whole promise is that it does not. The return value is the list of settings that could NOT be
 * restored, which the caller is expected to shout about.
 */
export async function restoreThemeSettings() {
	const entries = Object.entries(original);
	if (!entries.length) {
		return [];
	}
	try {
		await api('PUT', '/custom_theme_settings/', {
			custom_theme_settings: entries.map(([key, value]) => ({ key, value })),
		});
		console.log(`restored   ${entries.map(([key]) => key).join(', ')}`);
		return [];
	} catch (error) {
		return [`${entries.map(([key]) => key).join(', ')}: ${error.message}`];
	}
}
