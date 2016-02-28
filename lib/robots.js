const regexEscape = require('escape-string-regexp');

// Technique inspired by http://stackoverflow.com/a/32402438/1725509
function pathToRegexRule(path, allowed) {
	path = regexEscape(path);
	
	// Make all wildcards work properly
	path = path.replace("\\*", ".*");
	
	// Restore $ for end of URL
	path = path.replace("\$", "$");
	
	var regexString = "^" + path;
	
	var regex = new RegExp(regexString);
	
	// Note if a wildcard is used
	regex.wildcards = path.indexOf("*") !== -1;
	regex.slashes = path.match(/\//g).length;
	regex.pathLength = path.length;
	regex.allowed = allowed;
	regex.toString = () => regexString;
	
	return regex;
}

function sortRules(rules) {
	rules.sort(function(a, b) {
		// Want to sort descending, so most specific are first
		if (b.slashes > a.slashes) return 1;
		if (b.slashes < a.slashes) return -1;
		
		// Secondary metric is overall length
		if (b.pathLength > a.pathLength) return 1;
		if (b.pathLength < a.pathLength) return -1;
		
		// If equal in both metrics, prefer allowed
		if (b.allowed) return 1;
		if (a.allowed) return -1;
		
		return 0;
	});
}

module.exports = {
	parse(rawRobots) {
		var lines = [];
		
		// Split the raw robots file into its individual lines
		var temp = "";
		for (var i = 0; i < rawRobots.length; i++) {
			switch (rawRobots[i]) {
				case '\n':
					lines.push(temp);
					temp = "";
					break;
				case '\r':
					if (rawRobots[i+1] === '\n') i++;
					lines.push(temp);
					temp = "";
					break;
				default:
					temp += rawRobots[i];
			}
		}
		
		// Clean out blanks and comments
		var cleaned = [];
		for (var l of lines) {
			l = l.trim();
			if (l === "" || l[0] === "#") continue;
			
			var comment = l.indexOf("#");
			if (comment !== -1) {
				l = l.substring(0, comment);
				l = l.trimRight();
			}
			
			cleaned.push(l);
		}
		
		lines = cleaned;
		
		// This step could theoretically be combined with the above
		// Tokenize everything
		var tokens = [];
		
		for (var l of lines) {
			var colon = l.indexOf(":");
			
			// Any line with useful data should have a colon
			// Maybe should log when these lines are dropped
			if (colon === -1) continue;
			
			tokens.push(l.substring(0, colon).toLowerCase());
			
			var startingPosition = colon + 1;
			while (l[startingPosition] === " " || l[startingPosition] === "\t") {
				startingPosition++;
			}
			
			// No characters, no data
			// Probably should log this too
			if (l[startingPosition] === undefined) continue;
			
			tokens.push(l.substring(startingPosition));
		}
		
		// Start building an object representing this
		var out = {
			ua: {}
		};
		
		var currentUAs = [];
		var currentRules = [];
		
		for (var i = 0; i < tokens.length; i += 2) {
			var key = tokens[i];
			var value = tokens[i+1];
			
			switch (key) {
				case "user-agent":
					if (!currentUAs) {
						currentUAs = [value.toLowerCase()];
					} else if (currentRules.size === 0) {
						// Same properties for multiple UA's
						currentUAs.push(value.toLowerCase());
					} else {
						/* Starting a new set of properties */
						
						// Copy the values into the output
						sortRules(currentRules);
						for (var ua of currentUAs) {
							out.ua[ua] = currentRules;
						}
						
						// Create the new UA setup
						currentUAs = [value.toLowerCase()];
						currentRules = [];
					}
					break;
				case "sitemap":
					// Sitemap is outside of any one group
					out.sitemap = value;
					
					// Start a fresh UA
					for (var ua of currentUAs) {
						out.ua[ua] = currentRules;
					}
					currentUAs = [];
					currentRules = [];
					break;
				case "disallow":
				case "allow":
					// Disallow/allow are invalid outside of a UA
					if (!currentUAs) break;
					
					// All paths should start with /
					if (value[0] !== "/") break;
					
					currentRules.push(pathToRegexRule(value, key === "allow"));
					break;
				default:
					break;
			}
		}
		
		// Start a fresh UA
		for (var ua of currentUAs) {
			out.ua[ua] = currentRules;
		}
		currentUAs = [];
		currentRules = [];
		
		return out;
	},
	
	checkPath(rules, ua, path) {
		
		ua = ua.toLowerCase();
		
		// Find the rules for that UA
		var rulesKey = "";
		
		for (var agent in rules.ua) {
			if (ua.startsWith(agent) && rulesKey.length < agent.length) {
				rulesKey = agent;
			}
		}
		
		// Default UA
		if (rulesKey.length === 0) rulesKey = "*";
		
		rules = rules.ua[rulesKey];
		
		if (!rules) return true;
		
		// Winning rule with basic characteristics
		var winner;
		for (var r of rules) {
			if (r.test(path)) {
				winner = r;
				break;
			}
		}
		
		if (winner) {
			console.log(winner.toString());
			return winner.allowed;
		}
		
		return true;
		
	},
	
	serializeRules(rules, ua) {
		ua = ua.toLowerCase();
		
		// Find the rules for that UA
		var rulesKey = "";
		
		for (var agent in rules.ua) {
			if (ua.startsWith(agent) && rulesKey.length < agent.length) {
				rulesKey = agent;
			}
		}
		
		// Default UA
		if (rulesKey.length === 0) rulesKey = "*";
		
		rules = rules.ua[rulesKey];
		
		if (!rules) return undefined;
		
		var out = [];
		
		for (var r of rules) {
			var ruleStr = r.toString();
			if (r.allowed) out.push("1" + ruleStr);
			else out.push("0" + ruleStr);
		}
		
		return out.join("\n");
	},
	
	checkPathFromSerialized(serializedRules, path) {
		var rules = {};
		rules.ua = { "*": [] };
		
		serializedRules = serializedRules.split("\n");
		
		for (var s of serializedRules) {
			var allowed = true;
			if (s[0] === '0') {
				allowed = false;
			}
			
			var regex = new RegExp(s.substring(1));
			regex.allowed = allowed;
			
			rules.ua["*"].push(regex);
		}
		
		return this.checkPath(rules, "*", path);
	}
};