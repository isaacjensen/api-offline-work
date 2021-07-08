const sizeOf = require('image-size');

const { connectToDB } = require('./lib/mongo');
const { connectToRabbitMQ, getChannel } = require('./lib/rabbitmq');
const { getDownloadStreamById, updateImageDimensionsById, getImageInfoById, linkImageByID } = require('./models/image');
const { resizePhoto } = require('./models/photo')
connectToDB(async () => {
    await connectToRabbitMQ('images');
    const channel = getChannel();
    channel.consume('images', msg => {
        const id = msg.content.toString();
        console.log("== got message with id:", id);
        const imageChunks = [];
        getDownloadStreamById(id)
            .on('data', chunk => {
                imageChunks.push(chunk);
            })
            .on('end', async () => {
                // const dimensions = sizeOf(Buffer.concat(imageChunks));
                // console.log(" == computed dimensions", dimensions);
                // resizePhoto(dimensions, id, Buffer.concat(imageChunks));
                // const result = await updateImageDimensionsById(id, dimensions);
                // console.log(" == update result:", result);
                const sizes = [128, 256, 640, 1024]
                const dimensions = sizeOf(Buffer.concat(imageChunks));
                console.log("  -- computed dimensions:", dimensions);
                const info = await getImageInfoById(id)
                var result;
                var urls = {};
                for (let i = 0; i < sizes.length; i++) {
                    result = await updateImageDimensionsById(dimensions, Buffer.concat(imageChunks), info, i, sizes);
                }
                for (var i in result) { //handles only making smaller images
                    let important = Math.max(dimensions.height, dimensions.width);
                    if(important < i) {
                        delete result[i];
                    }
                }
                console.log(result);
                for (let i = 0; i < sizes.length; i++) {
                    var item = sizes[i];
                    var name = item.toString();
                    urls[name] = `/photos/media/images/${result[name]}`
                }
                const photoData = await linkImageByID(id, urls, result)
                console.log(photoData);
            });
        channel.ack(msg);
    });
});


