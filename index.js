var http = require("http"),
    fs = require('fs'),
    gju = require('geojson-utils'),
    parseString = require('xml2js').parseString,
    url = "http://map.labucketbrigade.org/feed",
    file = "incidents.json",
    incidents = require('./incidents.json'),
    parishes = require('./assets/layers/parishesMerged.json'),

objectTracker = function(startingCount){
  this.startingCount = startingCount;
  this.objectsChecked = 0;
  this.objectsWritten= 0;
  this.newRecords = [];
  this.newRecordDates = [];
  this.endingCount = function(){
    return this.startingCount + this.objectsWritten
  };
  this.addNewRecord = function(id){
    this.newRecords.push(id);
  };
  this.addNewRecordDate = function(date){
    this.newRecordDates.push(date);
  };
  this.incChecked = function(){
    this.objectsChecked ++;  
  };
  this.incWritten = function(){
    this.objectsWritten ++;
  };
},

incidentTracker = new objectTracker(incidents.length),

pointInTargetArea = function(point){
  var result = gju.pointInPolygon({"type":"Point","coordinates":point}, parishes)
  return result;
},

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

writeToFile = function(content){
  fs.writeFile(file, content, function(e){
    if(e) {
      console.log(e);
    } else {
        console.log("Incidents saved succesfully.");
    }
  })
},

generateIncidentID = function(guid){
  var splitArray = guid.split('/');
  return splitArray[splitArray.length - 1];
},

recordAlreadyExists = function(record){
  for (var i = 0; i < incidents.length; i++){
    if (incidents[i]['guid'][0] === record['guid'][0]){
      return true;
    }
  }
  return false;
},

formatInputData = function(inputData){
  inputData['coordinates'] = parseLatLong(inputData['georss:point'][0]);
  inputData['id'] = generateIncidentID(inputData['guid'][0]);
},

updateIncidents = function(inputData){
  for (var i = 0; i < inputData.length; i++){
    if (recordAlreadyExists(inputData[i]) === false){
      formatInputData(inputData[i]);
      if (pointInTargetArea(inputData[i]['coordinates']) === true){
        incidents.push(inputData[i]);
        incidentTracker.incWritten();
        incidentTracker.addNewRecord(inputData[i]['id']);
        incidentTracker.addNewRecordDate(inputData[i]['pubDate']);
      }
    }
  };
  return JSON.stringify(incidents, undefined, 2);
},

parseLatLong = function(latLngStrng){
  splitLatLng = latLngStrng.split(' ');
  lat = parseFloat(splitLatLng[0]);
  lng = parseFloat(splitLatLng[1]);
  splitLatLng[0] = lng;
  splitLatLng[1] = lat;
  return splitLatLng;
};

download(url, function(data) {
  //var json;
  if (data) {
    parseString(data, function (err, result) {
      var targetData = result['rss']['channel'][0]['item'],
          incidentString = updateIncidents(targetData);
      writeToFile(incidentString);
      console.log('Starting count: ' + incidentTracker.startingCount + '\n' + 
                  'Records added: ' + + incidentTracker.objectsWritten  + '\n' + 
                  'Ending count: ' + incidentTracker.endingCount() + '\n' + 
                  'New Record IDs: ' + incidentTracker.newRecords  + '\n' +
                  'New Record Dates: ' + incidentTracker.newRecordDates);
    });
  }
  else console.log("error");  
});
