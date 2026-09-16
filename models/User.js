const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    name: String,
    mobile: String,
    city: String,
    address: String,
    visitedStores: [String]
})

module.exports = mongoose.model('User', userSchema)