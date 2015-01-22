var http = require("http"),
    fs = require('fs'),
    parseString = require('xml2js').parseString,
    url = "http://map.labucketbrigade.org/feed",
    writeFile = "incidents.json",
    incidents = require('./incidents.json'),

download = function(url, callback) {
  http.get(url, function(res) {
    var data = "";
    res.on('data', function (chunk) {
      data += chunk;
    });
    res.on("end", function() {
      callback(data);
    });
  }).on("error", function() {
    callback(null);
  });
},

appendToFile = function(content){
  fs.appendFile(writeFile, content, function(e){
    if(e) {
      console.log(e);
    } else {
        console.log("The file was saved.");
    }
  })
},

download(url, function(data) {
  var json;
  if (data) {
    parseString(data, function (err, result) {
      var targetData = result['rss']['channel'][0]['item'];
      json = JSON.stringify(targetData, undefined, 2);
    });
    appendToFile(json);
  }
  else console.log("error");  
});
