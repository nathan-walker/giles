"use strict";

var redis = require('redis');
var http = require('http');
var https = require('https');
var robots = require('./robots');
var robotsRequest = require('request'); 
var Request = require('./request');

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
		
		this.connectionOptions = options.connection || {};
		options.concurrent = options.concurrent || 5;
		
		this.httpAgent = new http.Agent({
			maxSockets: options.concurrent
		});
		
		this.secureAgent = new https.Agent({
			maxSockets: options.concurrent
		});
		
		this.userAgent = options.userAgent || "Giles";
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
	 * @param protocol - "http:" or "https:"
	 * @param host - the hostname to check
	 * @param path - the path to check at the host
	 * @return Promise - returning true or false
	 */
	checkRobots(protocol, host, path) {
		
		return new Promise((resolve, reject) => {
			// Check if the robots.txt is available in redis
			this.redis.get(this.redisKey + "robots:" + protocol + host,
			(err, robotstxt) => {
				if (err) {
					reject(err);
					return;
				}
				
				if (robotstxt) {
					resolve(robots.checkPathFromSerialized(robotstxt, path));
					return;
				}
				
				// If not available, call fetchRobots()
				resolve(this.fetchRobots(protocol, host, path));
				
			});
		});
	}
	
	/**
	 * A function that attempts to download a robots.txt from a site
	 * @param protocol - "http:" or "https:"
	 * @param host - the hostname to check
	 * @return Promise - with either the robots.txt file or null
	 */
	fetchRobots(protocol, host, path) {
		
		return new Promise((resolve) => {
			// Fetch robots.txt using the appropriate agent
			robotsRequest.get(protocol + "//" + host + "/robots.txt", (err, res, body) => {
				
				var serialized = '1^\/';
				var testResult = true;
				
				// TODO: various server errors properly
				if (!err && res.statusCode === 200 && body) {
					var rules = robots.parse(body);
					if (rules) {
						serialized = robots.serializeRules(rules, this.userAgent) || '1^\/';
						testResult = robots.checkPath(rules, this.userAgent, path);
					}
				}
				
				// Return the result of the test
				resolve(testResult);
				
				// Insert robots.txt into redis
				this.redis.setex(this.redisKey + "robots:" + protocol + host, 60 * 60 * 24, serialized);
				
			});
		});
	}
	
	/**
	 * A function that will check the blacklist and robots.txt,
	 * then make the request
	 * 
	 * @param url - a url object
	 * @return a Promise for the end of the request
	 */
	makeRequest(url) {
		if (this.blacklist.has(url.hostname)) {
			//var err = new Error(url.hostname + " is on the blacklist");
			//err.type = "giles.blacklist";
			return Promise.resolve(null);
		}
		
		return this.checkRobots(url.protocol, url.host, url.path).then((allowed) => {
			if (!allowed) return null;
			
			var req = new Request(url, this.connectionOptions, this);
			
			return req.exec();
		});
	}
	
	
};