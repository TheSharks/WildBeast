var qs = require('querystring')

exports.get_gif = function (tags, func) {
  var params = {
    'api_key': 'dc6zaTOxFJmzC', // This is Giphy's public API key, so no, I haven't leaked my keys
    'rating': 'r',
    'format': 'json',
    'limit': 1
  }
  var query = qs.stringify(params)

  if (tags !== null) {
    query += '&tag=' + tags.join('+')
  }

  var request = require('request')

  request('http://api.giphy.com/v1/gifs/random' + '?' + query, function (error, response, body) {
    if (error || response.statusCode !== 200) {
      // Logger.log('debug', response)
    } else {
      var responseObj = JSON.parse(body)
      if (responseObj.data) {
        func(responseObj.data.id)
      } else {
        func(undefined)
      }
    }
  })
}
