const Request = require('./lib/request');
const Agent = require('./lib/agent');

var url = require('url').parse("http://imore.com/includes/");
var agent = new Agent({redisConnection: {}});

/*var req = new Request(url, undefined, agent);
req.exec().then((data) => {
	debugger;
}).catch((err) => {
	throw err;
});*/

agent.makeRequest(url).then((data) => {
	debugger;
}).catch((err) => {
	throw err;
});