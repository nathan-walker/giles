const Request = require('./lib/request');
const Agent = require('./lib/agent');

var url = require('url').parse("http://nwalker.org/");
var agent = new Agent({redisConnection: {}});

var req = new Request(url, undefined, agent);
req.exec().then((data) => {
	debugger;
});