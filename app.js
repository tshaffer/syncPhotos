// http://stackoverflow.com/questions/30179571/are-there-bookmarks-in-visual-studio-code
// https://marketplace.visualstudio.com/items?itemName=alefragnani.Bookmarks
// Ctrl-Alt K - toggle bookmarks
// Ctrl-Alt L - goto bookmarks

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const nodeDir = require('node-dir');

const express = require('express');
const axios = require('axios');
const https = require('https');

const app = express();
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

const photoFileExtensions=[
  'jpg',
  'png',
  'psd',
  'tif',
  'tiff'
];

// initialize 'global' variables
const fetchingGooglePhotos = true;
let photosById = {};

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

  let timestamp;
  const exifTimestamp = exifTags['exif:time'];
  if (exifTimestamp) {
    timestamp = photo['exif:tags'][0]['exif:time'][0];
  }
  else {
    timestamp = photo['gphoto:timestamp'][0];
  }
  let dateTime = new Date();
  let ts = Number(timestamp);
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
    imageUniqueId
  };
}

function getFileExtension(fileName) {
  return fileName.split('.').pop();
}

function isPhotoFile(fileName) {
  const ext = getFileExtension(fileName.toLowerCase());
  if ( (photoFileExtensions.indexOf(ext)) >= 0) {
    return true;
  }
  else {
    return false;
  }
}

function isPhoto(photo) {
  const fileName = photo.title[0]._;
  return isPhotoFile(fileName);
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
            if (isPhoto(googlePhoto)) {
              const photo = parseGooglePhoto(googlePhoto);
              allPhotos.push(photo);
            }
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

// how to match photo's
//  d:\Complete\3_01\P3090001.JPG
//    ignore exif info as that can't be relied on
//    resolution: matches
//    filename: matches
//    exif info if available


// Program start
// let driveExists = fs.existsSync("d:/");
// console.log(driveExists);




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




// const existingPhotosStr = fs.readFileSync("allGooglePhotos.json");
// const existingPhotosSpec = JSON.parse(existingPhotosStr);
// const existingGooglePhotos = existingPhotosSpec.photos;
// console.log("Number of existing google photos: ", Object.keys(existingGooglePhotos).length);

// // initialize allGooglePhotos and photosById with existing photos
// let allGooglePhotos = {};
// allGooglePhotos.version = 1;
// allGooglePhotos.photos = {};

// // populate with existing photos
// for (let sha1 in existingGooglePhotos) {
//   if (existingGooglePhotos.hasOwnProperty(sha1)) {
//     const existingGooglePhoto = existingGooglePhotos[sha1];
//     allGooglePhotos.photos[sha1] = existingGooglePhoto;
//     photosById[existingGooglePhoto.photoId] = existingGooglePhoto;
//   }
// }

// console.log("Number of photos in photosById: ", Object.keys(photosById).length);






// fetchGooglePhotos().then( (addedGooglePhotos) => {
  
//   console.log("Number of photos retrieved from google: ", Object.keys(addedGooglePhotos).length);

//   // merge new photos
//   for (let sha1 in addedGooglePhotos) {
//     if (addedGooglePhotos.hasOwnProperty(sha1)) {
//       allGooglePhotos.photos[sha1] = addedGooglePhotos[sha1];
//     }
//   }

//   // store google photo information in a file
//   const allGooglePhotosStr = JSON.stringify(allGooglePhotos, null, 2);
//   fs.writeFileSync('allGooglePhotos.json', allGooglePhotosStr);
//   console.log('Google photos reference file generation complete.');
// }, (reason) => {
//   console.log("fetchGooglePhotos failed: ", reason);
// });

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



console.log("syncPhotos - start");
console.log("__dirname: ", __dirname);

console.log("Retrieve existing google photos");
let existingGooglePhotos = [];
let promise = readGooglePhotoFiles('allGooglePhotos.json');
promise.then((existingPhotosStr) => {
  const existingPhotosSpec = JSON.parse(existingPhotosStr);
  existingGooglePhotos = existingPhotosSpec.photos;
  console.log("Number of existing google photos: ", existingGooglePhotos.length);
}, (reason) => {
  console.log('Error reading allGooglePhotos.json: ');
});

if (fetchingGooglePhotos) {

  fetchGooglePhotos().then( (addedGooglePhotos) => {
    
    console.log("Number of photos retrieved from google: ", addedGooglePhotos.length);

    // merge new photos (NOT MERGING YET)
    let allGooglePhotos = addedGooglePhotos;

    let allGooglePhotosSpec = {};
    allGooglePhotosSpec.version = 2;
    allGooglePhotosSpec.photos = allGooglePhotos;

    // store google photo information in a file
    const allGooglePhotosSpecStr = JSON.stringify(allGooglePhotosSpec, null, 2);
    fs.writeFileSync('allGooglePhotos.json', allGooglePhotosSpecStr);
    console.log('Google photos reference file generation complete.');
  }, (reason) => {
    console.log("fetchGooglePhotos failed: ", reason);
  });
}
