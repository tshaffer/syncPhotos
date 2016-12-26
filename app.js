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

function parseGooglePhoto(photo) {
  const id = photo['gphoto:id'][0];
  const name = photo.title[0]._;
  const timestamp = photo['exif:tags'][0]['exif:time'];
  return {
    id,
    name,
    timestamp
  };
}

function fetchGooglePhotos() {

  console.log('fetchAlbums');
  fetchAlbums().then((albumsResponse) => {

    console.log('albums successfully retrieved');

    // get albumId's for the albums that represent all our google photo's
    // there is generally one album per year
    const googlePhotoAlbumIds = parseAlbums(albumsResponse.feed.entry);
    // console.log("googlePhotoAlbumIds: ", googlePhotoAlbumIds);

    // fetch each album
    googlePhotoAlbumIds.forEach( (googlePhotoAlbumId) => {
      fetchAlbum(googlePhotoAlbumId).then( (result) => {
        const photos = result.entry;
        
        debugger;
      });
    });

  }, (reason) => {
    console.log("fetchAlbums failed: ", reason);

  });
}
console.log("syncPhotos - start");
console.log("__dirname: ", __dirname);

fetchGooglePhotos();

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

