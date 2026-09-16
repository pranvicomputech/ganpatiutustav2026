const mongoose = require('mongoose')

const apiHitSchema = new mongoose.Schema({
    endpoint: String,
    method: String,
    hits: Number
})

module.exports = mongoose.model('ApiHit', apiHitSchema)