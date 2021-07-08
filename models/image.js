const fs = require('fs');

const { ObjectId, GridFSBucket } = require('mongodb');
var Jimp = require('jimp');
const { getDBReference } = require('../lib/mongo');

exports.saveImageFile = function (image) {
  return new Promise((resolve, reject) => {
    const db = getDBReference();
    const bucket = new GridFSBucket(db, { bucketName: 'images' });

    const metadata = {
      contentType: image.contentType,
      userId: image.userId
    };

    const uploadStream = bucket.openUploadStream(
      image.filename,
      { metadata: metadata }
    );

    fs.createReadStream(image.path)
      .pipe(uploadStream)
      .on('error', (err) => {
        reject(err);
      })
      .on('finish', (result) => {
        resolve(result._id);
      });
  });
};

exports.getImageInfoById = async function (id) {
  const db = getDBReference();
  const bucket = new GridFSBucket(db, { bucketName: 'images' });
  if (!ObjectId.isValid(id)) {
    return null;
  } else {
    const results = await bucket.find({ _id: new ObjectId(id) })
      .toArray();
    return results[0];
  }
};

exports.getDownloadStreamByFilename = function (filename) {
  const db = getDBReference();
  const bucket = new GridFSBucket(db, { bucketName: 'images' });
  return bucket.openDownloadStreamByName(filename);
};

exports.getDownloadStreamById = function (id) {
  const db = getDBReference();
  const bucket = new GridFSBucket(db, { bucketName: 'images' });
  if (!ObjectId.isValid(id)) {
    return null;
  } else {
    return bucket.openDownloadStream(new ObjectId(id));
  }
};

// exports.updateImageDimensionsById = async function (id, dimensions) {
//   const db = getDBReference();
//   const collection = db.collection('images.files');
//   if (!ObjectId.isValid(id)) {
//     return null;
//   } else {
//     const result = await collection.updateOne(
//       { _id: new ObjectId(id) },
//       { $set: { "metadata.dimensions": dimensions }}
//     );
//     return result.matchedCount > 0;
//   }};
exports.updateImageDimensionsById = async function (dimensions, image, info, itr, imgSize) {
  const db = getDBReference();
  const collection = db.collection('images.files');
  const bucket = new GridFSBucket(db, {bucketName: 'photos'});
  var str = info.filename;
  var res = str.split(".");
  var filenames = {}
  var urls = {};

  for(var i in imgSize) {    
    var item = imgSize[i];   
    var name = item.toString();
    filenames[name] = `${res[0]}-${item}.jpg`;
    urls[name] = `/photos/media/images/${res[0]}-${item}.jpg`
  }
  Jimp.read(image).then(async newPhoto => {
    const buffer = await newPhoto.resize(imgSize[itr], imgSize[itr], Jimp.AUTO)
      .getBufferAsync(Jimp.MIME_JPEG);
    const uploadStream = bucket.openUploadStream(
      `${res[0]}-${imgSize[itr]}.jpg`,
        {filenames: filenames},
        {urls: urls}
    );
    uploadStream.write(buffer);
    uploadStream.end();
  }) 
  .catch(err => {
    console.error(err);
  });
  return filenames;
};

  exports.linkImageByID = async function (id, urls, filenames) {
    const db = getDBReference();
    const collection = db.collection('images.files');
    if (!ObjectId.isValid(id)) {
      return null;
    } else {
      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { "urls": urls,
      "filenames":filenames }}
      );
      return result.matchedCount > 0;
    }};