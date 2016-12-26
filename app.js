const path = require('path');
const fs = require('fs');
const express = require('express');
const axios = require('axios');

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

// return a list of albumIds for the albums referenced above
function parseAlbums(albums) {
  console.log("parseAlbums: # of albums=", albums.length);

  let googlePhotoAlbumIds = [];

  albums.forEach( (album) => {
    const albumName = album.title[0]._;
    const albumIndex = googlePhotoAlbums.indexOf(albumName);
    if (albumIndex > 0) {
      const albumId = album['gphoto:id'][0];
      console.log("albumId: ", albumId, " albumName: ", googlePhotoAlbums[albumIndex]);
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

  return new Promise( (resolve, reject) => {

    const getAlbumUrl = "http://picasaweb.google.com/data/feed/api/user/shafferfamilyphotostlsjr/albumid/" + albumId;

    axios.get(getAlbumUrl, {
      params: {albumId}
    }).then(function (albumResponse) {
      const xml = albumResponse.data;
      const parseString = require('xml2js').parseString;
      parseString(xml, function (_, result) {
        // console.dir(result);
        resolve(result.feed);
      });
    })
    .catch(function (fetchAlbumError) {
      console.log(fetchAlbumError);
      reject(fetchAlbumError);
    });
  });
}

function parseGooglePhoto(albumId, photo) {
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

  return {
    albumId,
    photoId,
    name,
    size,
    timestamp,
    dateTime
  };
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


      // fetchAlbumPromise.then( (result) => {
      //   let photosFromAlbum = [];
      //   const photos = result.entry;
      //   photos.forEach( (googlePhoto) => {
      //     if (isPhoto(googlePhoto)) {
      //       const photo = parseGooglePhoto(googlePhotoAlbumId, googlePhoto);
      //       photosFromAlbum.push(photo);
      //     }
      //   });
      //   resolve(photosFromAlbum);
      //   debugger;
    });

    Promise.all(promises).then( (googlePhotoAlbums) => {
      let allPhotos = [];
      googlePhotoAlbums.forEach( (googlePhotoAlbum) => {
        const photosInAlbum = googlePhotoAlbum.entry;
        photosInAlbum.forEach( (googlePhoto) => {
          if (isPhoto(googlePhoto)) {
            const googlePhotoAlbumId = googlePhoto['gphoto:albumid'][0];
            const photo = parseGooglePhoto(googlePhotoAlbumId, googlePhoto);
            allPhotos.push(photo);
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

      let promise = fetchPhotosFromAlbums(googlePhotoAlbumIds);
      promise.then( (allPhotos) => {
        debugger;
      });
      // if (photosFromAlbum[photo.name]) {
      //   console.log("photo ", photo.name, " already exists");
      // }
      // photosFromAlbum[photo.name] = photo;

    });

  });
}


// Program start

console.log("syncPhotos - start");
console.log("__dirname: ", __dirname);

fetchGooglePhotos().then( (shafferPhotos) => {
  console.log("number of shaffer photos from google: ", Object.keys(shafferPhotos).length);
  debugger;
}, (reason) => {
  console.log("fetchGooglePhotos failed: ", reason);
});

// var pizzaFolder = path.basename('C:\\Users\\Ted\Documents\\PizzaFolder');
// console.log(pizzaFolder);

// var pizzaFolder2 = path.win32.basename('C:\\Users\\Ted\Documents\\PizzaFolder');
// console.log(pizzaFolder2);

// var testFolder = 'C:\\Users\\Ted\\Documents\\PizzaFolder';
// fs.readdir(testFolder, (err, files) => {
//   files.forEach(file => {
//     console.log(file);
//   });
// })

