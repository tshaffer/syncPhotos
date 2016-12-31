// UTC issue
// exif data in google photos - exif timestamp is a local time, but is interpreted in the system as a UTC time,
// while the exif data on the file on the drive is a proper time - when a Date object is created, it shows a UTC time,
// which is 'n' hours later than the google photos time.
// in google photos, date created from exif timestamp is the local time; date created from timestamp shows the UTC time,
// and therefore, it matches the time on the local drive.


// http://stackoverflow.com/questions/30179571/are-there-bookmarks-in-visual-studio-code
// https://marketplace.visualstudio.com/items?itemName=alefragnani.Bookmarks
// Ctrl-Alt K - toggle bookmarks
// Ctrl-Alt L - goto bookmarks

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const nodeDir = require('node-dir');
const exifImage = require('exif').ExifImage;
const jpegJS = require('jpeg-js');

const express = require('express');
const axios = require('axios');
const https = require('https');

const app = express();

const utils = require('./utils');

const googlePhotoAlbums=[
  'Year2016', 
  'Year2015',
  'Year2014',
  'Year2013',
  'Year2012',
  'Year2008',
  'Year2007',
  'Year2006',
  'Year2005',
  'Year2004',
  'Year2003',
  'Year2002',
  'Year2001',
  'Year2000',
  'YearPre2000'
  ];

// initialize 'global' variables
// review which of these need to be 'global'
const fetchingGooglePhotos = false;
let photosById = {};                      // unclear if this is really used
let photosByKey = {};
let photosByExifDateTime = {};
let photosByName = {};
let existingGooglePhotos = [];
let existingPhotosSpec;
let volumeName = "unknown";

// return a list of albumIds for the albums referenced above
function parseAlbums(albums) {
  
  // console.log("parseAlbums: # of albums=", albums.length);

  let googlePhotoAlbumIds = [];

  albums.forEach( (album) => {
    const albumName = album.title[0]._;
    const albumIndex = googlePhotoAlbums.indexOf(albumName);
    if (albumIndex >= 0) {
      const albumId = album['gphoto:id'][0];
      // console.log("albumId: ", albumId, " albumName: ", googlePhotoAlbums[albumIndex]);
      googlePhotoAlbumIds.push(albumId);
    }
  });

  return googlePhotoAlbumIds;
}

function fetchAlbums() {

  return new Promise( (resolve, reject) => {

    const getAlbumsUrl = "http://picasaweb.google.com/data/feed/api/user/shafferfamilyphotostlsjr";
    axios.get(getAlbumsUrl)
      .then(function (albumsResponse) {
        const xml = albumsResponse.data;
        const parseString = require('xml2js').parseString;
        parseString(xml, function (_, result) {
          resolve(result);
        });
      })
      .catch(function (albumsError) {
        console.log(albumsError);
        reject(albumsError);
      });
  });
}

function fetchAlbum(albumId) {

  console.log("fetchAlbum:", albumId);

  return new Promise( (resolve, reject) => {

    const getAlbumUrl = "http://picasaweb.google.com/data/feed/api/user/shafferfamilyphotostlsjr/albumid/" + albumId;

    axios.get(getAlbumUrl, {
      params: {albumId}
    }).then(function (albumResponse) {
      console.log("album fetch complete");
      const xml = albumResponse.data;
      const parseString = require('xml2js').parseString;
      parseString(xml, function (_, result) {
        resolve(result.feed);
      });
    })
    .catch(function (fetchAlbumError) {
      console.log(fetchAlbumError);
      reject(fetchAlbumError);
    });
  });
}

function parseGooglePhoto(photo) {

  const photoId = photo['gphoto:id'][0];
  const name = photo.title[0]._;
  const url = photo['media:group'][0]['media:content'][0].$.url;
  const width = photo["gphoto:width"][0];
  const height = photo["gphoto:height"][0];

  const exifTags = photo['exif:tags'][0];

  let timestamp, ts;
  let exifDateTime = "";
  const exifTimestamp = exifTags['exif:time'];
  if (exifTimestamp) {
    timestamp = photo['exif:tags'][0]['exif:time'][0];
    exifDateTime = new Date();
    ts = Number(timestamp);
    exifDateTime.setTime(ts);
  }

  timestamp = photo['gphoto:timestamp'][0];
  let dateTime = new Date();
  ts = Number(timestamp);
  dateTime.setTime(ts);

  let imageUniqueId = '';
  const exifUniqueIdTag = exifTags["exif:imageUniqueID"];
  if (exifUniqueIdTag) {
    imageUniqueId = exifUniqueIdTag[0];
  }

  return {
    photoId,
    name,
    url,
    width,
    height,
    timestamp,
    dateTime,
    exifDateTime,
    imageUniqueId
  };
}

function fetchPhotosFromAlbums(googlePhotoAlbumIds) {

  return new Promise( (resolve, reject) => {

    let promises = [];

    // fetch each album
    googlePhotoAlbumIds.forEach( (googlePhotoAlbumId) => {
      let fetchAlbumPromise = fetchAlbum(googlePhotoAlbumId);
      promises.push(fetchAlbumPromise);
    });

    // wait until all albums have been retrieved, then get all photos
    // this wasn't the original intention, but I messed up the code,
    // figure out the right way to do it.
    Promise.all(promises).then( (googlePhotoAlbums) => {
      let allPhotos = [];
      googlePhotoAlbums.forEach( (googlePhotoAlbum) => {
        const photosInAlbum = googlePhotoAlbum.entry;
        photosInAlbum.forEach( (googlePhoto) => {
          // check to see if photo has already been retrieved
          const photoId = googlePhoto["gphoto:id"][0];
          if (!photosById[photoId]) {
            if (utils.isPhoto(googlePhoto)) {
              const photo = parseGooglePhoto(googlePhoto);
              allPhotos.push(photo);
            }
          }
          else {
            console.log("*************************** DUPLICATE GOOGLE ID FOUND ***********************");
            debugger;
          }
        });
      });
      resolve(allPhotos);
    });
  });
}

function fetchGooglePhotos() {

  console.log('fetchGooglePhotos');

  return new Promise( (resolve, reject) => {

    console.log('fetchAlbums');
    fetchAlbums().then((albumsResponse) => {

      console.log('albums successfully retrieved');

      // get albumId's for the specific albums that represent all our google photo's
      const googlePhotoAlbumIds = parseAlbums(albumsResponse.feed.entry);

      // get all photos in an array
      let promise = fetchPhotosFromAlbums(googlePhotoAlbumIds);
      promise.then( (allPhotos) => {
        resolve(allPhotos);
      });
    });
  });
}

function readGooglePhotoFiles(path) {
  return new Promise( (resolve, reject) => {
    fs.readFile(path, (err, data) => {
      if (err) {
        reject(err);
      }
      else {
        resolve(data);
      }
    });
  });
}


// http://stackoverflow.com/questions/36094026/unable-to-read-from-console-in-node-js-using-vs-code
// https://code.visualstudio.com/Docs/editor/debugging

// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout
// });

// rl.question('What do you think of Node.js? ', (answer) => {
//   // TODO: Log the answer in a database
//   console.log(`Thank you for your valuable feedback: ${answer}`);

//   rl.close();
// });

function buildPhotoDictionaries() {

  photosByKey = {};
  photosByExifDateTime = {};
  photosByName = {};

  let numDuplicates = 0;
  existingGooglePhotos.forEach( (photo) => {

    const name = photo.name;

    if (photo.exifDateTime && photo.exifDateTime !== '') {
      photosByExifDateTime[photo.exifDateTime] = photo;
    }

    const key = (name + '-' + photo.width + photo.height).toLowerCase();
    if (photosByKey[key]) {
      numDuplicates++;
    }
    else {
      photosByKey[key] = photo;
    }

    if (photosByName[name]) {
      photosByName[name].photoList.push(photo);

    }
    else {
      photosByName[name] = {};
      photosByName[name].photoList = [photo];
    }
  });

  fs.writeFileSync('photosByExifDateTime.json', JSON.stringify(photosByExifDateTime, null, 2));
  fs.writeFileSync('photosByKey.json', JSON.stringify(photosByKey, null, 2));
  fs.writeFileSync('photosByName.json', JSON.stringify(photosByName, null, 2));
  debugger;
}

function setSearchResult(photoFile, success, reason, error) {
  return {
    photoFile,
    success,
    reason,
    error
  };
}

function findPhotoByKey(photoFile) {
  const name = path.basename(photoFile);
  const jpegData = fs.readFileSync(photoFile);
  try {
    const rawImageData = jpegJS.decode(jpegData);
    const key = (name + '-' + rawImageData.width.toString() + rawImageData.height.toString()).toLowerCase();
    if (photosByKey[key]) {
      return setSearchResult(photoFile, true, 'keyMatch', '');
    }
    else {
      return setSearchResult(photoFile, false, 'noKeyMatch', '');
    }
  } catch (jpegJSError) {
    return setSearchResult(photoFile, false, 'jpegJSError', jpegJSError);
  };
}

function findFile(photoFile) {

  let searchResult = {};

  return new Promise( (resolve, reject) => {
    try {
      new exifImage({ image : photoFile }, function (error, exifData) {

        if (error || !exifData || !exifData.exif || (!exifData.exif.CreateDate && !exifData.exif.DateTimeOriginal)) {

          // no exif date - search in photosByKey if it's a jpeg file
          if (utils.isJpegFile(photoFile)) {
            searchResult = findPhotoByKey(photoFile);
          }
          else {
            searchResult = setSearchResult(photoFile, false, 'noExifNotJpg', error);
          }
          resolve(searchResult);
        }
        else {
          let dateTimeStr = '';
          if (exifData.exif.CreateDate) {
            dateTimeStr = exifData.exif.CreateDate;
          }
          else {
            dateTimeStr = exifData.exif.DateTimeOriginal;
          }
          const exifDateTime = utils.getDateFromString(dateTimeStr);
          const isoString = exifDateTime.toISOString();
          if (photosByExifDateTime[isoString]) {
            searchResult = setSearchResult(photoFile, true, 'exifMatch', '');
          }
          else {
            if (utils.isJpegFile(photoFile)) {
              searchResult = findPhotoByKey(photoFile);
            }
            else {
              searchResult = setSearchResult(photoFile, false, 'noExifMatch', '');
            }
          }
          searchResult.isoString = isoString;
          if (!exifData.exif.CreateDate) {
            console.log(photoFile);
            console.log(exifDateTime);
            console.log(isoString);
            console.log(searchResult);
            // debugger;
          }
          resolve(searchResult);
        }
      });
    } catch (error) {
      searchResult = setSearchResult(photoFile, false, 'other', error);
      resolve(searchResult);
    }
  });
}

function saveSearchResults(searchResults) {

  // first time initialization
  // let allResults = {};
  // allResults.Volumes = {};

  // must use async version if file read failure is possible
  const existingResultsStr = fs.readFileSync('searchResults.json');
  let allResults = JSON.parse(existingResultsStr);
  
  // build results based on this search
  let volumeResults = {};
  volumeResults.noKeyMatch = [];
  volumeResults.noExifMatch = [];
  volumeResults.noExifNotJpg = [];
  volumeResults.errorOther = [];

  let numMatchesFound = 0;

  let numExifMatches = 0;
  let numKeyMatches = 0;

  let numNoKeyMatches = 0;
  let numNoExifMatches = 0;
  let numNoExifNotJpgs = 0;

  let numJpegJsErrors = 0;
  let numOthers = 0;
  
  searchResults.forEach( (searchResult) => {

    if (searchResult.success) {
      numMatchesFound++;
    }
    
    switch(searchResult.reason) {
      case 'exifMatch':
        numExifMatches++;
        break;
      case 'keyMatch':
        numKeyMatches++;
        break;
      case 'noExifMatch':
        volumeResults.noExifMatch.push({file: searchResult.photoFile});
        numNoExifMatches++;
        break;
      case 'noKeyMatch':
        volumeResults.noKeyMatch.push({file: searchResult.photoFile});
        numNoKeyMatches++;
        break;
      case 'noExifNotJpg':
        volumeResults.noExifNotJpg.push({file: searchResult.photoFile});
        numNoExifNotJpgs++;
        break;
      case 'jpegJSError':
        volumeResults.errorOther.push({file: searchResult.photoFile});
        numJpegJsErrors++;
        break;
      case 'other':
        volumeResults.errorOther.push({file: searchResult.photoFile});
        numOthers++;
        break;
    }
  });

  console.log('Total number of matches: ', numMatchesFound);
  console.log('numExifMatches', numExifMatches);
  console.log('numKeyMatches:', numKeyMatches);
  console.log('numNoExifMatches', numNoExifMatches);
  console.log('numNoKeyMatches:',numNoKeyMatches);
  console.log('numNoExifNotJpgs', numNoExifNotJpgs);
  console.log('numJpegJsErrors:', numJpegJsErrors);
  console.log('numOthers', numOthers);

  // update data structure
  allResults.lastUpdated = new Date().toLocaleDateString();
  allResults.Volumes[volumeName] = volumeResults;

  // // store search results in a file
  const allResultsStr = JSON.stringify(allResults, null, 2);
  fs.writeFileSync('searchResults.json', allResultsStr);

  debugger;
}

function findMissingFiles() {

  buildPhotoDictionaries();

  nodeDir.files("d:/", (err, files) => {
    if (err) throw err;
    files = files.filter(utils.isPhotoFile);

    console.log("Photos on drive: ", files.length);

    let promises = [];
    files.forEach( (file) => {
      promise = findFile(file);
      promises.push(promise);
    });
    Promise.all(promises).then( (searchResults) => {
      saveSearchResults(searchResults);
    });
  });
}

function runFetchGooglePhotos() {

  fetchGooglePhotos().then( (addedGooglePhotos) => {
    
    console.log("Number of photos retrieved from google: ", addedGooglePhotos.length);

    // merge new photos (NOT MERGING YET)
    let allGooglePhotos = addedGooglePhotos;

    let allGooglePhotosSpec = {};
    allGooglePhotosSpec.version = 3;
    allGooglePhotosSpec.photos = allGooglePhotos;

    // store google photo information in a file
    const allGooglePhotosSpecStr = JSON.stringify(allGooglePhotosSpec, null, 2);
    fs.writeFileSync('allGooglePhotos.json', allGooglePhotosSpecStr);
    console.log('Google photos reference file generation complete.');
  }, (reason) => {
    console.log("fetchGooglePhotos failed: ", reason);
  });
}

function matchFiles() {

  console.log("Retrieve existing google photos");
  existingGooglePhotos = [];
  let promise = readGooglePhotoFiles('allGooglePhotos.json');
  promise.then((existingPhotosStr) => {
    existingPhotosSpec = JSON.parse(existingPhotosStr);
    existingGooglePhotos = existingPhotosSpec.photos;
    console.log("Number of existing google photos: ", existingGooglePhotos.length);

    existingGooglePhotos.forEach( (photo, index) => {
      if (photo.exifDateTime !== '') {
        photo.exifDateTime = photo.dateTime;
      }
    });

    findMissingFiles();

  }, (reason) => {
    console.log('Error reading allGooglePhotos.json: ');
  });
}

// Program start
console.log("syncPhotos - start");
console.log("__dirname: ", __dirname);

// const photoFile = "D:\\9-1-2006\\My Pictures\\2006\\03_March_1\\_DSC4093.jpg";
// new exifImage({ image : photoFile }, function (error, exifData) {
//   debugger;
// });

// volumeName = "Photos5";
// matchFiles();



if (fetchingGooglePhotos) {
  runFetchGooglePhotos();
}
else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Enter the volume name: ', (vName) => {

    rl.close();

    console.log("volumeName is: ", vName);

    volumeName = vName;

    matchFiles();
  });
}


