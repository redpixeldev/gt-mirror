/*
 * Keep Cloudflare's hands off the Demo site's HTML.
 *
 * Cloudflare injects its JavaScript Detections script (/cdn-cgi/challenge-platform/scripts/jsd/main.js)
 * into every HTML page it proxies, and that script touches three deprecated browser APIs — FencedFrame,
 * the persistent storage quota and Protected Audience — which Lighthouse charges to the page as
 * first-party "Uses deprecated APIs" and reports as Best Practices 77. Two Cloudflare layers sit in
 * front of the Demo site (the redpixelthemes.com zone and Laravel Cloud's own edge), and under Bot Fight
 * Mode the injection cannot be switched off. A `no-transform` directive from the origin stops it on
 * either layer (developers.cloudflare.com/cache/concepts/cache-control, "JavaScript Detections").
 *
 * It also stops Cloudflare recompressing the response, which costs nothing here: Ghost already
 * compresses at the origin. Only HTML carries the directive, because only HTML is injected into.
 *
 * Ghost has no setting for extra Cache-Control directives, so this wraps Node's writeHead, the one
 * place every response passes through with its headers final: Express's send and Ghost's static
 * middleware both reach it through ServerResponse's implicit header, and the compression middleware
 * wraps whichever writeHead it finds — this one, when it is installed before Ghost loads.
 */
import { ServerResponse } from 'node:http';

export function withNoTransform(cacheControl, contentType) {
	if (!String(contentType ?? '').startsWith('text/html')) return cacheControl;
	if (!cacheControl) return 'no-transform';
	if (/(^|,)\s*no-transform\s*(,|$)/i.test(cacheControl)) return cacheControl;
	return `${cacheControl}, no-transform`;
}

export function installNoTransform(proto = ServerResponse.prototype) {
	const writeHead = proto.writeHead;
	proto.writeHead = function (...args) {
		const value = withNoTransform(this.getHeader('cache-control'), this.getHeader('content-type'));
		if (value !== undefined) this.setHeader('cache-control', value);
		return writeHead.apply(this, args);
	};
}
