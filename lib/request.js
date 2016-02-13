"use strict";

var http = require('http');
var https = require('https');

function Request(url, options, agent) {
	if (!url) throw new Error("URL required for Giles Request");
	
	options = options || {};
	
	// Empty string to hold the data (which is assumed text-based)
	var data = "";
	var dataSize = 0;
	
	// Empty err to hold any possible errors to reject with
	var err;
	
	var redirectChain = [];
	
	/**
	 * A function that will be called when data is received
	 * @param d - the chunk of data received
	 */
	function onData(d) {
		data += d;
		dataSize += d.length;
		if (options.maxSize && options.maxSize < dataSize) kill();
	}
	
	/**
	 * A function that will be called when the headers are received
	 * @param res - a http(s).incomingMessage object
	 */
	function onResponse(res) {
		
	}
	
	/**
	 * Immediately terminates the connection
	 * Triggers an error for the send() function
	 */
	function kill() {
		
	}
	
	/**
	 * An event that fires if a redirect code is encountered
	 */
	function onRedirect() {
		
	}
	
	return new Promise((resolve, reject) => {
		
	});
}

module.exports = Request;