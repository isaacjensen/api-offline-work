const express = require('express');
const morgan = require('morgan');

const api = require('./api');
const { connectToDB } = require('./lib/mongo');
const { getDownloadStreamByFilename, updateImageDimensionsById } = require('./models/image');
const { connectToRabbitMQ, getChannel } = require('./lib/rabbitmq');
const app = express();
const port = process.env.PORT || 8000;

/*
 * Morgan is a popular logger.
 */
app.use(morgan('dev'));

app.use(express.json());
app.use(express.static('public'));

const imageTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png'
};
//HELPERS

// async function resizePhoto(id, photos, size) {
//   var sizes = [128,256,640,1024];
//   sizes.forEach((size) => {
//     if(dimensions.height > size) {

//     }
//   })
// }

//



/*
 * All routes for the API are written in modules in the api/ directory.  The
 * top-level router lives in api/index.js.  That's what we include here, and
 * it provides all of the routes.
 */
app.use('/', api);

app.get('/media/photos/:filename', (req,res,next) => {
  console.log("-- req.params.filename:", req.params.filename);
  getDownloadStreamByFilename(req.params.filename)
  .on('error', (err) => {
    if (err.code === 'ENOENT') {
      next();
    } else {
      next(err);
    }
  })
  .on('file', (file) => {
    res.status(200).type(file.metadata.contentType);
  })
  .pipe(res);
});



app.use('*', function (req, res, next) {
  res.status(404).json({
    error: "Requested resource " + req.originalUrl + " does not exist"
  });
});

connectToDB(async () => {
  console.log(" -- CONNECTED TO DB ---");
  await connectToRabbitMQ('images');
  console.log(" -- CONNECTED TO RABBIT ---");
  app.listen(port, () => {
    console.log("== Server is running on port", port);
  });
});
