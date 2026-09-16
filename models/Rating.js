const mongoose = require('mongoose')
const ratingSchema = new mongoose.Schema({
    storeSlug: String,
    userName: String,
    userMobile: String,
    rating: Number
})
module.exports = mongoose.model('Rating', ratingSchema)
