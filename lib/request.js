"use strict";

const EventEmitter = require('events');
const http = require('http');
const https = require('https');
const urlLib = require('url');
const toughCookie = require('tough-cookie');

// http://stackoverflow.com/a/19709846/1725509
const absoluteUrlCheck = new RegExp('^(?:[a-z]+:)?//', 'i');

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
		
		this.on('redirect', (url) => this._onRedirect(url));
	}
	
	get cookies() {
		if (this.cookieJar) {
			return this.cookieJar.getCookiesSync(this.url).join("; ");
		} else {
			return undefined;
		}
	}
	
	get _httpOptions() {
		var obj = {
			protocol: this.url.protocol,
			hostname: this.url.hostname,
			port: this.url.port,
			path: this.url.path,
			headers: {
				// https://developer.mozilla.org/en-US/docs/Web/HTTP/Content_negotiation#The_Accept.3a_header
				"Accept": "text/html;q=0.9,*/*;q=0.8",
				// "Accept-Encoding": "gzip", maybe some day
				"User-Agent": this.agent.userAgent
			}
		};
		var cookies = this.cookies;
		if (cookies) obj.headers["Cookie"] = cookies;
		return obj;
	}
	
	get responseObject() {
		return {
			data: this.data,
			redirectChain: this.redirectChain
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
		
		// Set timeout
		if (this.options.timeout) {
			this.request.socket.setTimeout(this.options.timeout);
			this.request.socket.on('timeout', () => {
				var err = new Error("Connection timed out");
				err.type = "giles.timeout";
				this._kill(err);
			});
		}
		
		this.request.on('abort', () => this._onClientAbort());
		this.request.on('response', (res) => this._onResponse(res));
		this.request.on('end', () => this._onEnd());
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
		
		var headers = res.headers;
		
		if (headers['set-cookie']) {
			if (!this.cookieJar) this.cookieJar = new toughCookie.CookieJar();
			headers['set-cookie'].forEach((c) => {
				this.cookieJar.setCookieSync(c, this.url);
			});
		}
		
		// Check status code/if redirect
		switch (res.statusCode) {
			case 200:
				break;
			case 301:
			case 302:
			case 303:
			case 307:
				var url;
				var location = headers['location'];
				if (absoluteUrlCheck.test()) {
					url = location;
				} else {
					url = urlLib.resolve(this.url, location);
				}
				return this.emit('redirect', url);
			case 404: 
				var err = new Error("Page not found");
				err.type = "giles.notfound";
				return this._kill(err);
			default: 
				var err = new Error(res.statusMessage);
				err.type = "giles.fetcherror";
				return this._kill(err);
		}
		
		// Check if return type is text/html
		if (!headers['content-type'].startsWith('text/html')) {
			var err = new Error("Content type is "+headers['content-type']);
			err.type = "giles.badtype";
			return this._kill(err);
		}
		
		// Check if content-length is greater than max
		// Set max size to content-length
		if (headers['content-length']) {
			if (headers['content-length'] > this.options.maxSize) {
				var err = new Error("Content size is too large");
				err.type = "giles.maxlength";
				return this._kill(err);
			}
			
			this.options.maxSize = headers['content-length'];
		}
		
		// Check that encoding is acceptable
		if (headers['content-encoding'] && headers['content-encoding'] !== "identity") {
			var err = new Error("Unacceptable encoding type: "+headers['content-encoding']);
			err.type = "giles.unsupported-encoding";
			return this._kill(err);
		}
		
		// Add all of the appropriate listeners to res
		res.on('data', (d) => this._onData(d));
		res.on('end', () => this._onEnd());
		
		// Set this.response to res
		this.response = res;
	}
	
	_onRedirect(url) {
		this.request.removeAllListeners();
		this.request.abort();
		
		this.redirectChain.push(this.url);
		
		var oldUrl = this.url;
		this.url = urlLib.parse(url);
		
		// If the host and protocol don't change, we don't need to recheck
		if (oldUrl.hostname === this.url.hostname
				&& oldUrl.protocol === this.url.protocol) {
			this._send();
			return;
		}
		
		// Check blacklist
		if (this.agent.blacklist.has(this.url.hostname)) {
			var err = new Error("Redirected URL is in blacklist");
			err.type = "giles.blacklist";
			this._kill(err);
			return;
		}
		
		// Check robots.txt
		this.agent.checkRobots(this.url.protocol, this.url.host, this.url.path)
			.then((allowed) => {
				if (allowed) this._send();
				else {
					var err = new Error(url + " is not permitted by robots.txt");
					err.type = "giles:robots";
					this._kill(err);
				}
			}).catch((err) => {
				this._kill(err);
			});
	}
	
	_onEnd() {
		this.redirectChain.push(this.url);
		this.emit('complete', this.responseObject);
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