const Request = require('./lib/request');
const Agent = require('./lib/agent');

var url = require('url').parse("https://www.youtube.com/watch?v=e5R75lCSNEA");
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