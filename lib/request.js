"use strict";

const EventEmitter = require('events');
const http = require('http');
const https = require('https');
const toughCookie = require('tough-cookie');

class Request extends EventEmitter {
	
	constructor(url, options, agent) {
		super();
		
		if (!url) throw new Error("URL required for Giles Request");
		if (!agent) throw new Error("Agent required for Giles Request");
		
		this.url = url;
		this.options = options || {};
		this.agent = agent;
		
		this.redirectChain = [];
		this.data = "";
		this.dataSize = 0;
		
		this.promise = new Promise((resolve, reject) => {
			this.on('error', reject);
			this.on('complete', resolve);
		});
		
		this.on('redirect', this._onRedirect);
	}
	
	get cookies() {
		if (this.cookieJar) {
			return this.cookieJar.getCookiesSync(this.url).join("; ");
		} else {
			return undefined;
		}
	}
	
	get _httpOptions() {
		return {
			protocol: this.url.protocol,
			hostname: this.url.hostname,
			port: this.url.port,
			path: this.url.path,
			headers: {
				// https://developer.mozilla.org/en-US/docs/Web/HTTP/Content_negotiation#The_Accept.3a_header
				"Accept": "text/html;q=0.9",
				// "Accept-Encoding": "gzip", maybe some day
				"User-Agent": this.agent.userAgent,
				"Cookie": this.cookies
			}
		};
	}
	
	_send() {
		
		// TODO: request timeout: http://stackoverflow.com/questions/6214902/how-to-set-a-timeout-on-a-http-request-in-node
		
		var options = this._httpOptions;
		if (options.protocol === 'http:') {
			options.agent = this.agent.httpAgent;
			this.request = http.get(options);
		} else if (options.protocol === 'https:') {
			options.agent = this.agent.secureAgent;
			this.request = https.get(options);
		} else {
			return this.emit('error', new Error("Request does not fit HTTP or HTTPS protocols"));
		}
		
		this.request.on('data', this._onData);
		this.request.on('abort', this._onClientAbort);
		this.request.on('response', this._onResponse);
		this.request.on('end', this._onEnd);
	}
	
	_onData(d) {
		this.data += d;
		this.dataSize += d.length;
		if (this.options.maxSize && this.options.maxSize < this.dataSize) {
			var err = new Error("Content exceeds maximum length");
			err.type = "giles.maxlength";
			this._kill(err);
		}
	}
	
	_onClientAbort() {
		var err = new Error("The connection was aborted.");
		err.type = "giles.aborted";
		this.emit('error', err);
	}
	
	_onResponse(res) {
		// res is a http(s).IncomingMessage
		
		// Check status code/if redirect
		
		
		// Check if return type is text/html
		
		// Check if content-length is greater than max
		// Set max size to content-length
		
		// Check that encoding is acceptable
		
		// Add all of the appropriate listeners to res
		
		// Set this.response to res
	}
	
	_kill(err) {
		this.request.abort();
		this.emit('error', err);
	}
	
	exec() {
		// User-facing method to start request and return a Promise	
		this._send();
		return this.promise;
	}
	
}

module.exports = Request;