const path = require('path');
const fs = require('fs');

const express = require('express');
const axios = require('axios');
const sha1 = require('sha1');
const https = require('https');

const app = express();
const googlePhotoAlbums=[
  // 'Year2016', 
  'Year2015',
  // 'Year2014',
  // 'Year2013',
  // 'Year2012',
  // 'Year2008',
  // 'Year2007',
  // 'Year2006',
  // 'Year2005',
  // 'Year2004',
  // 'Year2003',
  // 'Year2002',
  // 'Year2000',
  // 'YearPre2000'
  ];

const photoFileExtensions=[
  'jpg',
  'png',
  'psd',
  'tif',
  'tiff'
];

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

function toBuffer(ab) {
    var buf = new Buffer(ab.byteLength);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buf.length; ++i) {
        buf[i] = view[i];
    }
    return buf;
}

let numPhotosRetrieved = 0;

function getPhotoDetails(photoUrl) {

  // console.log("fetch photo from:", photoUrl);

  return new Promise( (resolve, reject) => {

    https.get(photoUrl, (res) => {
      const statusCode = res.statusCode;
      if (statusCode != 200) {
        debugger;
      }
      // console.log('STATUS: ' + res.statusCode);
      // console.log('HEADERS: ' + JSON.stringify(res.headers));

      // console.log("length:", res.headers["content-length"]);

      const fileLength = Number(res.headers["content-length"]);
      let buffer = new Uint8Array(fileLength);

      let writeIndex = 0;
      let totalLength = 0;

      res.on('data', function (d) {
        buffer.set(d, writeIndex);
        writeIndex += d.length;

        totalLength += d.length;
      });
      res.on('end', function () {
        // console.log("totalLength: ", totalLength);

        console.log("numPhotosRetrieved: ", numPhotosRetrieved++);

        const bf = toBuffer(buffer);
        const bfSha1 = sha1(bf);

        photoProperties = {
          sha1: bfSha1,
          size: totalLength
        };
        resolve(photoProperties);
      });
    }).on('error', (e) => {
      console.log("error: ", e.message);
      console.log(photoUrl);
      debugger;
    });
  });
}

function parseGooglePhoto(albumId, photo) {

  return new Promise( (resolve, reject) => {

    const photoId = photo['gphoto:id'][0];
    const name = photo.title[0]._;

    let timestamp;
    const exifTags = photo['exif:tags'][0];
    const exifTimestamp = exifTags['exif:exif:timestamp'];
    if (exifTimestamp) {
      timestamp = photo['exif:tags'][0]['exif:time'][0];
    }
    else {
      timestamp = photo['gphoto:timestamp'][0];
    }

    const size = photo['gphoto:size'][0];

    let dateTime = new Date();
    let ts = Number(timestamp);
    dateTime.setTime(ts);
    // const dateTime = new Date().setTime(Number(timestamp));

    const url = photo['media:group'][0]['media:content'][0].$.url;
    getPhotoDetails(url).then( (photoProperties) => {
      resolve({
        albumId,
        photoId,
        name,
        size: photoProperties.size,
        timestamp,
        dateTime,
        sha1: photoProperties.sha1
      });
    });
  });
}

function getFileExtension(fileName) {
  return fileName.split('.').pop();
}

// probably a better way to get this information from photo object
function isPhoto(photo) {
  const fileName = photo.title[0]._;
  const ext = getFileExtension(fileName.toLowerCase());

  if ( (photoFileExtensions.indexOf(ext)) >= 0) {
    return true;
  }
  else {
    return false;
  }
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
      let parsePhotoPromises = [];
      googlePhotoAlbums.forEach( (googlePhotoAlbum) => {
        const photosInAlbum = googlePhotoAlbum.entry;

        photosInAlbum.forEach( (googlePhoto) => {
          if (isPhoto(googlePhoto)) {
            const googlePhotoAlbumId = googlePhoto['gphoto:albumid'][0];

            // parseGooglePhoto(googlePhotoAlbumId, googlePhoto).then( (photo) => {
            //   allPhotos.push(photo);
            // });

            let parsePhotoPromise = parseGooglePhoto(googlePhotoAlbumId, googlePhoto);
            parsePhotoPromises.push(parsePhotoPromise);
          }
          });
      });

      Promise.all(parsePhotoPromises).then( (allPhotos) => {
        resolve(allPhotos);
      });
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
        let shafferPhotos = {};
        allPhotos.forEach( (photo) => {
          shafferPhotos[photo.sha1] = photo;
        })
        resolve(shafferPhotos);
      });
    });
  });
}


// Program start

console.log("syncPhotos - start");
console.log("__dirname: ", __dirname);

console.log("Read existing google photos");
const existingPhotosStr = fs.readFileSync("allGooglePhotos.json");
const existingGooglePhotos = JSON.parse(existingPhotosStr);
console.log("Number of existing google photos: ", Object.keys(existingGooglePhotos).length);

// merge existing and new photos
let allGooglePhotos = {};
allGooglePhotos.version = 1;
allGooglePhotos.photos = {};

// populate with existing photos
for (let sha1 in existingGooglePhotos) {
  if (existingGooglePhotos.hasOwnProperty(sha1)) {
    allGooglePhotos.photos[sha1] = existingGooglePhotos[sha1];
  }
}

fetchGooglePhotos().then( (addedGooglePhotos) => {
  
  console.log("Number of photos retrieved from google: ", Object.keys(addedGooglePhotos).length);

  // merge new photos
  for (let sha1 in addedGooglePhotos) {
    if (addedGooglePhotos.hasOwnProperty(sha1)) {
      allGooglePhotos.photos[sha1] = addedGooglePhotos[sha1];
    }
  }

  // store google photo information in a file
  const allGooglePhotosStr = JSON.stringify(allGooglePhotos, null, 2);
  fs.writeFileSync('allGooglePhotos.json', allGooglePhotosStr);
  console.log('Google photos reference file generation complete.');
}, (reason) => {
  console.log("fetchGooglePhotos failed: ", reason);
});

