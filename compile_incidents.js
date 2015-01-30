var http = require("http"),
    fs = require('fs'),
    gju = require('geojson-utils'),
    parseString = require('xml2js').parseString,
    url = "http://map.labucketbrigade.org/feed",
    log = "./log.txt",
    now = new Date(),
    geoIncidents = require('./assets/layers/geoIncidents.json'),
    geoIncidentsFile = './assets/layers/geoIncidents.json',
    requireFile = './assets/layers/eyewitness-require.js',
    parishes = require('./assets/layers/parishesMerged.json'),
    maxSize = 6,

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

writeToJsonFile = function(content){
  fs.writeFile(geoIncidentsFile, content, function(e){
    if(e) {
      console.log(e);
    } else {
        console.log("Incidents saved succesfully.");
    }
  })
},

calculateFileSize = function(file){
  var stats = fs.statSync(file),
      bytes = stats['size'],
      megabytes = bytes / 1000000.0;
      return megabytes;
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

formatDescriptionString = function(string){
  return string.replace(/Play [mM]essage: *[\n]+.*/, '');
},

formatInputData = function(inputData){
  inputData['coordinates'] = parseLatLong(inputData['georss:point'][0]);
  inputData['id'] = generateIncidentID(inputData['guid'][0]);
  inputData['description'] = formatDescriptionString(inputData['description'][0])
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
  return JSON.stringify(geoIncidents) //(layer, undefined, 2) to prettify;
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
      "description": incident['description'],
      "pubDate": incident['pubDate'][0],
      "category": incident['category'][0],
      "id": incident['id']
    }
  })
};

download(url, function(data) {
  oldMegabytes = calculateFileSize(geoIncidentsFile);
  if (data && oldMegabytes < maxSize) {
    parseString(data, function (err, result) {
      var targetData = result['rss']['channel'][0]['item'],
          incidentString = updateIncidents(targetData),
          megabytes, record;
      writeToJsonFile(incidentString);
      fs.writeFile(requireFile, 'define(' + incidentString + ');');
      newMegabytes = calculateFileSize(geoIncidentsFile);
      record = '\n' + now + '\n' +
        'Starting count: ' + incidentTracker.startingCount + '\n' + 
        'Records added: ' + + incidentTracker.objectsWritten  + '\n' + 
        'Ending count: ' + incidentTracker.endingCount() + '\n' + 
        'New Record IDs: ' + incidentTracker.newRecords  + '\n' +
        'File size: ' + oldMegabytes + ' MB' + '\n';
      console.log(record);
      fs.appendFile(log, record);
    });
  }
  else console.log("The file wasn't written. The file size may be too large.\n" + "Increase the 'maxSize' value and try again.");  
});


