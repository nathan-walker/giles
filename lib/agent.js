"use strict";

var redis = require('redis');
var http = require('http');
var https = require('https');

module.exports = class Agent {
	/**
	 * Creates a new Giles agent with various options
	 * @param options - an object of options for the agent
	 * @param options.redisConnection - an object of redis connection options
	 * @param options.redisKey - a prefix for all redis keys used by the agent
	 * @param options.concurrent - the number of concurrent connections allowed per host
	 * @param options.connection - an object with options for each connection
	 * @param options.userAgent - a short value denoting the UA
	 */
	constructor(options) {
		this.blacklist = new Set();
		
		if (options.redisConnection) {
			this.redis = redis.createClient(options.redisConnection);
			this.redisKey = options.redisKey || "giles:";
		}
		
		if (!this.redis) throw new Error("Error establishing a Redis connection");
		
		// Set the update interval (defaults to 10 minutes)
		var updateInterval = options.updateInterval || 10 * 60 * 1000;
		this.updateBlacklist();
		setInterval(this.updateBlacklist, updateInterval);
		
		this.connectionOptions = options.connection;
		
		this.httpAgent = new http.Agent({
			maxSockets: options.concurrent
		});
		
		this.secureAgent = new https.Agent({
			maxSockets: options.concurrent
		});
		
		this.userAgent = options.userAgent;
	}
	
	/**
	 * A function that loads the latest version of the blacklist from redis
	 */
	updateBlacklist() {
		this.redis.smembers(this.redisKey + "blacklist", function(err, members) {
			if (err) return;
			
			this.blacklist = new Set(members);
		});
	}
	
	/**
	 * A function that checks if a url is permissible by robots.txt
	 * @param protocol - "http" or "https"
	 * @param host - the hostname to check
	 * @param path - the path to check at the host
	 * @return Promise - returning true or false
	 */
	checkRobots(protocol, host, path) {
		// Check if the robots.txt is available in redis
		
		// If not available, call fetchRobots()
		
		// If robots.txt still not available, return true
		
		// Process robots.txt to see if path is OK
		
		// Return appropriate value
		
	}
	
	/**
	 * A function that attempts to download a robots.txt from a site
	 * @param protocol - "http" or "https"
	 * @param host - the hostname to check
	 * @return Promise - with either the robots.txt file or null
	 */
	fetchRobots(protocol, host) {
		// Fetch robots.txt using the appropriate agent
		
		// If not available, return null
		
		// Insert robots.txt into redis
		
		// Return the contents of robots.txt
	}
	
	
};