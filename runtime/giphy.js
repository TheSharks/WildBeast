/*
TODO: Change runtime to be more random
*/

var qs = require("querystring");
var Logger = require("./logger.js").Logger;

exports.get_gif = function(tags, func) {
  //limit=1 will only return 1 gif
  var params = {
    "api_key": "dc6zaTOxFJmzC",
    "rating": "r",
    "format": "json",
    "limit": 1
  };
  var query = qs.stringify(params);

  if (tags !== null) {
    query += "&q=" + tags.join('+');
  }

  //wouldnt see request lib if defined at the top for some reason:\
  var request = require("request");
  //Logger.log("debug", query)

  request("http://api.giphy.com/v1/gifs/search" + "?" + query, function(error, response, body) {
    //Logger.log("debug", arguments)
    if (error || response.statusCode !== 200) {
      Logger.log("error", "giphy: Got error: " + body);
      Logger.log("error", error);
      //Logger.log("debug", response)
    } else {
      var responseObj = JSON.parse(body);
      Logger.log("debug", responseObj.data[0]);
      if (responseObj.data.length) {
        func(responseObj.data[0].id);
      } else {
        func(undefined);
      }
    }
  }.bind(this));
};
