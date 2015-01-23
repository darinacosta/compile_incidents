var http = require("http"),
    fs = require('fs'),
    gju = require('geojson-utils'),
    parseString = require('xml2js').parseString,
    Sftp = require('sftp-upload'),
    url = "http://map.labucketbrigade.org/feed",
    geoIncidents = require('./assets/layers/geoIncidents.json'),
    geoIncidentsFile = './assets/layers/geoIncidents.json',
    parishes = require('./assets/layers/parishesMerged.json'),

sftp = new Sftp({
  host:'54.148.242.90',
  username:'ubuntu',
  path: '/',
  remoteDir: '/tempDir',
  privateKey: fs.readFileSync('a_key.pem')
}),

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

incidentTracker = new objectTracker(geoIncidents['features'].length),

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
  fs.writeFile(geoIncidentsFile, content, function(e){
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
  var features = geoIncidents['features'];
  for (var i = 0; i < features.length; i++){
    var properties = features[i]['properties'];
    if (properties['link'] === record['guid'][0]){
      return true;
    }
  }
  return false;
},

parseLatLong = function(latLngStrng){
  splitLatLng = latLngStrng.split(' ');
  lat = parseFloat(splitLatLng[0]);
  lng = parseFloat(splitLatLng[1]);
  splitLatLng[0] = lng;
  splitLatLng[1] = lat;
  return splitLatLng;
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
        pushToGeoJson(inputData[i]);
        incidentTracker.incWritten();
        incidentTracker.addNewRecord(inputData[i]['id']);
        incidentTracker.addNewRecordDate(inputData[i]['pubDate']);
      }
    }
  };
  return JSON.stringify(geoIncidents, undefined, 2);
},

pushToGeoJson = function(incident){
  var geoJsonFeatures = geoIncidents['features'];
  geoJsonFeatures.push({
    "type": "Feature",
    "geometry": {
      "type": "Point",
      "coordinates": incident['coordinates']
    },
    "properties":{
      "title": incident['title'][0],
      "link": incident['link'][0],
      "description": incident['description'][0],
      "pubDate": incident['pubDate'][0],
      "category": incident['category'][0],
      "id": incident['id']
    }
  })
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


