/**
 * Created by go on 2017/11/16.
 */
var os = require("os");

/**
 * @private
 * Handler function for the simple.getMemory command.
 * @param {boolean} total If true, return total memory; if false, return free memory only.
 * @return {number} The amount of memory.
 */
function cmdGetMemory(total) {
  if (total) {
    return os.totalmem();
  } else {
    return os.freemem();
  }
}

/**
 * Initializes the test domain with several test commands.
 * @param {DomainManager} domainManager The DomainManager for the server
 */
function init(domainManager) {
  if (!domainManager.hasDomain("simple")) {
    domainManager.registerDomain("simple", {major: 0, minor: 1});
  }
  domainManager.registerCommand(
    "simple",       // domain name
    "getMemory",    // command name
    cmdGetMemory,   // command handler function
    false,          // this command is synchronous in Node
    "Returns the total or free memory on the user's system in bytes",
    [{name: "total", // parameters
      type: "string",
      description: "True to return total memory, false to return free memory"}],
    [{name: "memory", // return values
      type: "number",
      description: "amount of memory in bytes"}]
  );
}

exports.init = init;