const mongoose = require('mongoose')
const storeSchema = new mongoose.Schema({
    name: String,
    slug: String,
    mapLink: String,
    image: String,
    instaId: String,
    serialIndex: Number
})
module.exports = mongoose.model('Store', storeSchema)