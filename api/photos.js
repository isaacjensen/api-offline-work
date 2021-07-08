/*
 * API sub-router for businesses collection endpoints.
 */

const router = require('express').Router();
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const { getImageInfoById, saveImageInfo, saveImageFile, getDownloadStreamByFilename } = require('../models/image');
const { validateAgainstSchema } = require('../lib/validation');
const worker = require('../dimensionsWorker');
const {
  PhotoSchema,
  insertNewPhoto,
  getPhotoById
} = require('../models/photo');
const { connectToRabbitMQ, getChannel } = require('../lib/rabbitmq');

const acceptedFileTypes = {
  'image/jpeg':'jpg',
  'image/png':'png',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: `${__dirname}/uploads`, 
    filename: (req, file, callback) => {
      const filename = crypto.pseudoRandomBytes(16).toString('hex');
      const extension = acceptedFileTypes[file.mimetype];
      callback(null, `${filename}.${extension}`);
    }
  }),
  fileFilter: (req,file,callback) => {
    callback(null, !!acceptedFileTypes[file.mimetype]) //true if mimetype in acceptedFileTypes, false if not
  }
});

/*
 * Route to create a new photo.
 */
router.post('/', upload.single('image'), async (req, res, next) => {
  console.log(" -- req.body:",req.body);
  console.log(" -- req.file:",req.file);
  console.log(" -- req.body.businessid:",req.body.businessid);
  console.log(" -- req.body.caption:",req.body.caption);

  if(req.file && req.body) {
    const image = {
      contentType: req.file.mimetype,
      filename: req.file.filename,
      path: req.file.path,
      userId: req.body.userId,
      businessid: req.body.businessid,
      caption: req.body.caption
    };
    try {
      //const id = await saveImageInfo(image);
      const id = await saveImageFile(image);
      console.log(" == saved image! =");
      await connectToRabbitMQ('images');
      const channel = getChannel();
      channel.sendToQueue('images', Buffer.from(id.toString()));
      res.status(200).send({
        id: id,
        links: {
          photo: `photos/${id}`,
          business: `/businesses/${req.body.businessid}`
        }
      });
    } catch (err) {
      console.log('error in catch');
      next(err);
    }
  } else {
    res.status(400).send({
      error: "Request body was invalid"
    });
  }
});


/*
 * Route to fetch info about a specific photo.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const image = await getImageInfoById(req.params.id);
    if (image) {
      // delete image.path;
      // image.url = `/media/images/${image.filename}`
      const responseBody = {
        _id: image._id,
        url: `/media/photos/${image.filename}`,
        filename: image.filename,
        contentType: image.metadata.contentType,
        businessid: image.metadata.businessid,
        dimensions: image.metadata.dimensions
      };
      res.status(200).send(responseBody);
    } else {
      next();
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
