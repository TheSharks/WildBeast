/*
TODO: Change runtime to be more random
*/

var qs = require('querystring')

exports.get_gif = function (tags, func) {
  // limit=1 will only return 1 gif
  var params = {
    'api_key': 'dc6zaTOxFJmzC',
    'rating': 'r',
    'format': 'json',
    'limit': 1
  }
  var query = qs.stringify(params)

  if (tags !== null) {
    query += '&q=' + tags.join('+')
  }

  // wouldnt see request lib if defined at the top for some reason:\
  var request = require('request')
  // Logger.log('debug', query)

  request('http://api.giphy.com/v1/gifs/search' + '?' + query, function (error, response, body) {
    // Logger.log('debug', arguments)
    if (error || response.statusCode !== 200) {
      // Logger.log('debug', response)
    } else {
      var responseObj = JSON.parse(body)
      if (responseObj.data.length) {
        func(responseObj.data[0].id)
      } else {
        func(undefined)
      }
    }
  })
}
