"use strict";

var redis = require('redis');

module.exports = class Agent {
	/**
	 * Creates a new Giles agent with various options
	 * @param options - an object of options for the agent
	 *  
	 */
	constructor(options) {
		this.blacklist = new Set(options.blacklist);
		
		if (options.redisConnection) {
			this.redis = redis.createClient(options.redisConnection);
		}
		
		// Set the update interval (defaults to 10 minutes)
		if (this.redis) {
			var updateInterval = options.updateInterval || 10 * 60 * 1000;
			this.updateBlacklist();
			setInterval(this.updateBlacklist, updateInterval);
		}
		
		this.connectionOptions = options.connection;
	}
	
	updateBlacklist() {
		this.redis.smembers(this.redisKey, function(err, members) {
			if (err) return;
			
			this.blacklist = new Set(members);
		});
	}
};