var http = require("http"),
    fs = require('fs'),
    parseString = require('xml2js').parseString;

// Utility function that downloads a URL and invokes
// callback with the data.
function download(url, callback) {
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
}

var url = "http://map.labucketbrigade.org/feed"

download(url, function(data) {
  var json;
  if (data) {
    parseString(data, function (err, result) {
        json = JSON.stringify(result);
    });
    fs.writeFile("test.json", json, function(e){
      if(e) {
        console.log(e);
      } else {
          console.log("The file was saved!");
      }
    })
  }
  else console.log("error");  
});